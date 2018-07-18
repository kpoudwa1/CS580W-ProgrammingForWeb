const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});

const Steg = require('steg');
const Ppm = require('ppm');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function serve(port, base, images) {
  const app = express();

  //Body parser added for json
  app.use(bodyParser.json());
 // app.use(upload.single('file'));


  app.locals.port = port;
  app.locals.base = base;
  app.locals.images = images;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = {
  serve: serve
}

/** Prefix for image services */
const IMAGES = 'images'; 

/** Prefix for steganography services */
const STEG = 'steg';

/** Field name for image file upload */
const IMG_FIELD = 'img';

/** Set up routes based on IMAGES and STEG for all URLs to be handled
 *  by this server with all necessary middleware and handlers.
 */
function setupRoutes(app) {
  const base = app.locals.base;
  app.get(`${base}/${IMAGES}/:group/:name/meta`, getMeta(app));

  //Route for listing images
  app.get(`${base}/${IMAGES}/:group`, listImages(app));

  //Route for getting image
  app.get(`${base}/${IMAGES}/:group/:name.:type`, getImage(app));

  //Route for creating image
  app.post(`${base}/${IMAGES}/:group`, upload.single('img'),createImage(app));

  //Route for STEG HIDE
  app.post(`${base}/${STEG}/:group/:name`, stegHide(app));

  //Route for STEG UNHIDE
  app.get(`${base}/${STEG}/:group/:name`, stegUnhide(app));
}

/************************** Image Services *****************************/

/** Given a multipart-form containing a file uploaded for parameter
 *  IMG_FIELD, store contents of file in image store with group
 *  specified by suffix of request URL.  The name of the stored image
 *  is determined automatically by the image store and the type of the
 *  image is determined from the extension of the originalname of the
 *  uploaded file.
 *
 *  If everything is ok, set status of response to CREATED with
 *  Location header set to the URL at which the newly stored image
 *  will be available.  If not ok, set response status to a suitable
 *  HTTP error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function createImage(app) {
  return async function(req, res)
  {
	try
	{
		//Get the group for the image
		const group = req.params.group;

		//Get the image type
		const imageType = req.file.originalname.substring(req.file.originalname.lastIndexOf('.') + 1);

		//Insert the image in database
		const dbName = await app.locals.images.putBytes(group, new Uint8Array(req.file.buffer), imageType);

		//Create the location URL
		var url = 'http:\/\/localhost:' + app.locals.port + app.locals.base + '/' + IMAGES + '/' + group + '/' + dbName + '.' + imageType;

		//Append the location URL in the response
		res.append('Location', url);

		//Set the status and end the response
		res.status(CREATED).end();
	}
	catch(err)
	{
		const mapped = mapError(err);
		res.status(mapped.status).json(mapped);
	}
  };
}

/** If everything ok, set response status to OK with body containing
 *  bytes of image representation specified by group/name.ext suffix
 *  of request URL.  If not ok, set response status to a suitable HTTP
 *  error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function getImage(app) {
  return async function(req, res)
  {
	try
	{
		//Get the group, name and type from the request
		const {group, name, type} = req.params;

		//Get the bytes of the image
		const bytes = await app.locals.images.get(group, name, type);

		//Set the appropriate content type for the response
		if(type === 'ppm')
			res.type('ppm');
		else if(type === 'png')
			res.type('png');

		//Return the bytes back in binary format
		res.status(OK).send(new Buffer(bytes));
	}
	catch(err)
	{
		const mapped = mapError(err);
		res.status(mapped.status).json(mapped);
	}
  };
}


/** If everything ok, set response status to OK with body containing
 *  JSON of image meta-information specified by group/name of request
 *  URL.  If not ok, set response status to a suitable HTTP error
 *  status and return JSON object with "code" and "message" properties
 *  giving error details.
 */
function getMeta(app) {
  return async function(req, res) {
    try {
      const {group, name} = req.params;
      const meta = await app.locals.images.meta(group, name);
      res.status(OK).json(meta);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}


/** If everything ok, set response status to OK with body containing a
 *  JSON list (possibly empty) of image names for group suffix of
 *  request URL.  If not ok, set response status to a suitable HTTP
 *  error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function listImages(app) {
  return async function(req, res)
  {
	try
	{
		//Get the group from the request
		const group = req.params.group;

		//Get the list from database
		const list = await app.locals.images.list(group);

		//Return the list
		res.status(OK).json(list);
	}
	catch(err)
	{
		const mapped = mapError(err);
		res.status(mapped.status).json(mapped);
	}
  }
}


/*********************** Steganography Services ************************/

/** This service is used for hiding a message in the image specified
 *  by its request URL.  It requires a JSON request body with a 
 *  parameter "msg" giving the message to be hidden and a "outGroup"
 *  parameter giving the group of the image being created.  The message
 *  will be hidden in a new image with group set to the value of
 *  "outGroup" and a auto-generated name.
 *
 *  If everything is ok, set the status of the response to CREATED
 *  with Location header set to the URL which can be used to unhide
 *  the hidden message.  If not ok, set response status to a suitable
 *  HTTP error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function stegHide(app) {
  return async function(req, res)
  {
	try
	{
		//Get the group and name from the request
		const {group, name} = req.params;

		//Get the bytes of the image
		const bytes = await app.locals.images.get(group, name, "ppm");

		//Create a ppm object with the original image
		const ppm = new Ppm(name, new Uint8Array(new Buffer(bytes)));

		//Create a steg object
		const steg = new Steg(ppm);

		//Hide the message in the image
		var ppmOut = steg.hide(req.body.msg);

		//Store the image containing hidden message in database in the output group
		//const dbName = await app.locals.images.putBytes(req.body.outGroup, ppmOut.bytes, "ppm", name);
		const dbName = await app.locals.images.putBytes(req.body.outGroup, ppmOut.bytes, "ppm");

		//Create the location URL
		var url = 'http:\/\/localhost:' + app.locals.port + app.locals.base + '/' + STEG + '/' + req.body.outGroup + '/' + dbName;

		//Append the location URL in the response
		res.append('Location', url);

		//Set the status and end the response
		res.status(CREATED).end();
	}
	catch(err)
	{
		const mapped = mapError(err);
		res.status(mapped.status).json(mapped);
	}
  };
}

/** If everything ok, set response status to OK with body containing a
 *  JSON object with property "msg" containing the message hidden in
 *  the image specified by the URL for this request.  If not ok, set
 *  response status to a suitable HTTP error status and return JSON
 *  object with "code" and "message" properties giving error details.
 */
function stegUnhide(app) {
  return async function(req, res)
  {
	try
	{
		//Get the group and name from the request
		const {group, name} = req.params;

		//Get the bytes of the image from the database
		const bytes = await app.locals.images.get(group, name, "ppm");

		//Create a ppm object with the image containing hidden message
		const ppm = new Ppm(name, new Uint8Array(new Buffer(bytes)));

		//Create a steg object
		const steg = new Steg(ppm);

		//Get the hidden message from the image
		var msg = steg.unhide();

		//Set the status and return the hidden message
		res.status(OK).json({msg: msg});
	}
	catch(err)
	{
		const mapped = mapError(err);
		res.status(mapped.status).json(mapped);
	}
  };
}

/******************************* Utilities *****************************/

/** Given params object containing key: value pairs, return an object
 *  containing a suitable "code" and "message" properties if any value
 *  is undefined; otherwise return falsey.
 */
function checkMissing(params) {
  const missing =
    Object.entries(params).filter(([k, v]) => typeof v === 'undefined')
      .map(([k, v]) => k);
  return missing.length > 0 &&
    { code: 'MISSING',
      message: `field(s) ${missing.join(', ')} not specified`
    };
}


//Object mapping domain error codes to HTTP status codes.
const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND,
  READ_ERROR: SERVER_ERROR,
  WRITE_ERROR: SERVER_ERROR,
  UNLINK_ERROR: SERVER_ERROR
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return err.isDomain
    ? { status: (ERROR_MAP[err.errorCode] || BAD_REQUEST),
	code: err.errorCode,
	message: err.message
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/** Return URL (including host and port) for HTTP request req.
 *  Useful for producing Location headers.
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}
  
