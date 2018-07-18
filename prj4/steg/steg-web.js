'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});
const path = require('path');
const axios = require('axios');
const mustache = require('mustache');
const fs = require('fs');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function serve(port, wsURL) {
  const app = express();

  //Body parser added for json
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  app.locals.port = port;
  app.locals.wsURL = wsURL;
  //app.locals.images = images;
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
  //For displaying the index.html
  app.get(`/index.html`, getIndex(app));

  //For displaying images for hiding page
  app.get(`/listImagesToHide`, getImagesToHideMessage(app));

  //For hiding the message
  app.post(`/performHide`, upload.single('uploadedMessage'), processHide(app));

  //For displaying images for unhiding page
  app.get(`/listImagesToUnhide`, getImagesToUnhideMessage(app));

  //For getting the hidden message
  app.post(`/performUnhide`, processUnhide(app));

}

//Function for returning the index file
function getIndex(app)
{
	return async function(req, res)
	{
		try
		{
			//Return the index.html file
			res.sendFile(path.join(__dirname + '/index.html'));
		}
		catch(err)
		{
			var errorData = {};
			errorData.status = 'Error';
			errorData.code = '404';
			errorData.message = err;

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/DefaultError.ms'))), errorData);
			res.send(html);
		}
	};
}

//Function for displaying images in inputs group for hiding message
function getImagesToHideMessage(app)
{
	return async function(req, res)
	{
		try
		{
			var wsURL = app.locals.wsURL;

			//For getting the list of the images with group name as 'inputs'
			var imagesList = await axios.get(wsURL + '/api/images/inputs');
			var imagesArray = Array.from(imagesList.data);

			//Createing JSON object for the template
			var images = {};
			var imageDetails = [];

			//Adding the images in the imageDetails
			for(var i = 0; i < imagesArray.length; i++)
			{
				//Create a temporary image JSON
				var tempImage = {};
				tempImage.img_name = imagesArray[i];
				tempImage.img_bytes = wsURL + '/api/images/inputs/' + imagesArray[i] + '.png';

				//Add the object to the list
				imageDetails.push(tempImage);
			}

			var dataList = {};
			dataList.images = imageDetails;
			images.formdata = dataList;
			//Clear the object if there are no images
			if(dataList.images.length === 0)
				images = {};

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/Hide.ms'))), images);
			res.send(html);
		}
		catch(err)
		{
			var errorData = {};
			errorData.status = 'Error';
			errorData.code = err.code;
			errorData.message = err;

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/DefaultError.ms'))), errorData);
			res.send(html);
		}
	};
}

//Function for hiding the message in the selected image
function processHide(app)
{
	return async function(req, res)
	{
		try
	        {
			var wsURL = app.locals.wsURL;

			//Getting image name and the message
			var imageName = req.body.images;

			//Creating JSON object for web service call
			var requestData = {};
			requestData.outGroup = 'steg';

			//Check if the user entered the message or uploaded the file
			if(req.body.MessageChoice === 'text')
			{
				if(req.body.message != undefined && req.body.message != null && req.body.message.length > 0)
					requestData.msg = req.body.message;
			}
			else if(req.body.MessageChoice === 'file')
			{
				if(req.file != undefined && req.file != null && req.file.buffer != undefined && req.file.buffer != null)
					requestData.msg = req.file.buffer.toString();
			}

			//Calling the web service for hiding the message
			var result = await axios.post(wsURL + '/api/steg/inputs/' + imageName, requestData);

			//Setting the mustache data
			var mustacheData = {};
			mustacheData.img_name = result.headers.location.substr(result.headers.location.lastIndexOf('/') + 1);
			mustacheData.img_url = result.headers.location;

			//Render the html from html file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/HideSuccess.ms'))), mustacheData);
			res.send(html);
	        }
        	catch(err)
	        {
			var wsURL = app.locals.wsURL;

			//Getting image name and the message
			var imageName = req.body.images;

			//For getting the list of the images with group name as 'inputs'
			var imagesList = await axios.get(wsURL + '/api/images/inputs');
			var imagesArray = Array.from(imagesList.data);

			//Createing JSON object for the template
			var images = {};
			var imageDetails = [];

			//Adding the images in the imageDetails
			for(var i = 0; i < imagesArray.length; i++)
			{
				//Create a temporary image JSON
				var tempImage = {};
				tempImage.img_name = imagesArray[i];
				tempImage.img_bytes = wsURL + '/api/images/inputs/' + imagesArray[i] + '.png';
				if(imageName !== undefined && imageName !== null && imageName.length > 0 && imageName === imagesArray[i])
					tempImage.checked = 'checked';

				//Add the object to the list
				imageDetails.push(tempImage);
			}

			//Set the message
			//Check if the user entered the message or uploaded the file
			if(req.body.MessageChoice === 'text')
			{
				if(req.body.message != undefined && req.body.message != null && req.body.message.length > 0)
				{
					images.msg = req.body.message;
					images.msgtxt = 'checked';
				}
			}
			else if(req.body.MessageChoice === 'file')
			{
				images.msgupload = 'checked';
			}

			var dataList = {};
			dataList.images = imageDetails;
			images.formdata = dataList;
			if(dataList.images.length === 0)
				images = {};

			//Set  the errors
			images.errors = err.response.data;

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/Hide.ms'))), images);
			res.send(html);
	        }
	};
}

//Function for displaying images in steg group for unhiding message
function getImagesToUnhideMessage(app)
{
	return async function(req, res)
	{
		try
		{
			var wsURL = app.locals.wsURL;

			//For getting the list of the images with group name as 'steg'
			var imagesList = await axios.get(wsURL + '/api/images/steg');
			var imagesArray = Array.from(imagesList.data);

			//Creating JSON object for template
			var images = {};
			var imageDetails = [];

			//Adding the images in the imageDetails
			for(var i = 0; i < imagesArray.length; i++)
			{
				//Create a temporary image JSON
				var tempImage = {};
				tempImage.img_name = imagesArray[i];
				tempImage.img_bytes = wsURL + '/api/images/steg/' + imagesArray[i] + '.png';

				//Add the object to the list
				imageDetails.push(tempImage);
			}

			var dataList = {};
			dataList.images = imageDetails;
			images.formdata = dataList;
			if(dataList.images.length === 0)
				images = {};

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/Unhide.ms'))), images);
			res.send(html);
		}
		catch(err)
		{
			var errorData = {};
			errorData.status = 'Error';
			errorData.code = err.code;
			errorData.message = err;

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/DefaultError.ms'))), errorData);
			res.send(html);
		}
	};
}

//Function for unhiding the message from the selected image
function processUnhide(app)
{
	return async function(req, res)
	{
		try
		{
			var wsURL = app.locals.wsURL;

			//Getting image name
			var imageName = req.body.images;

			//Getting the hidden message from web service call
			var hiddenMessage = await axios.get(wsURL + '/api/steg/steg/' + imageName);

			//Setting the mustache data
			var mustacheData = {};
			mustacheData.hidden_message = hiddenMessage.data.msg;

			//Get the html from mustache
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/UnhideSuccess.ms'))), mustacheData);
			res.send(html);
		}
		catch(err)
		{
			var wsURL = app.locals.wsURL;

			//Getting image name
			var imageName = req.body.images;

			//For getting the list of the images with group name as 'steg'
			var imagesList = await axios.get(wsURL + '/api/images/steg');
			var imagesArray = Array.from(imagesList.data);

			//Creating JSON object for template
			var images = {};
			var imageDetails = [];

			//Adding the images in the imageDetails
			for(var i = 0; i < imagesArray.length; i++)
			{
				//Create a temporary image JSON
				var tempImage = {};
				tempImage.img_name = imagesArray[i];
				tempImage.img_bytes = wsURL + '/api/images/steg/' + imagesArray[i] + '.png';
				if(imageName !== undefined && imageName !== null && imageName.length > 0 && imageName === imagesArray[i])
					tempImage.checked = 'checked';

				//Add the object to the list
				imageDetails.push(tempImage);
			}

			var dataList = {};
			dataList.images = imageDetails;
			images.formdata = dataList;
			if(dataList.images.length === 0)
				images = {};

			//Set  the errors
			images.errors = err.response.data;

			//Render html from the mustache file
			const html = mustache.render(String(fs.readFileSync(path.join(__dirname, 'templates', '/Unhide.ms'))), images);
			res.send(html);
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
  
