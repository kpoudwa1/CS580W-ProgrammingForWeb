'use strict';

const Ppm = require('./ppm');

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
//TODO: add require()'s as necessary

/** This module provides an interface for storing, retrieving and
 *  querying images from a database. An image is uniquely identified
 *  by two non-empty strings:
 *
 *    Group: a string which does not contain any NUL ('\0') 
 *           characters.
 *    Name:  a string which does not contain any '/' or NUL
 *           characters.
 *
 *  Note that the image identification does not include the type of
 *  image.  So two images with different types are regarded as
 *  identical iff they have the same group and name.
 *  
 *  Error Handling: If a function detects an error with a defined
 *  error code, then it must return a rejected promise rejected with
 *  an object containing the following two properties:
 *
 *    errorCode: the error code
 *    message:   an error message which gives details about the error.
 *
 *  If a function detects an error without a defined error code, then
 *  it may reject with an object as above (using a distinct error
 *  code), or it may reject with a JavaScript Error object as
 *  appropriate.
 */

function ImgStore() { //TODO: add arguments as necessary
  //TODO
}

ImgStore.prototype.close = close;
ImgStore.prototype.get = get;
ImgStore.prototype.list = list;
ImgStore.prototype.meta = meta;
ImgStore.prototype.put = put;

/** Factory function for creating a new img-store.
 */
async function newImgStore() {
  //TODO
  return new ImgStore(); //provide suitable arguments
}
module.exports = newImgStore;

/** URL for database images on mongodb server running on default port
 *  on localhost
 */
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'images';

//List of permitted image types.
const IMG_TYPES = [
  'ppm', 
  'png'
];


/** Release all resources held by this image store.  Specifically,
 *  close any database connections.
 */
async function close() {
  //TODO
}

/** Retrieve image specified by group and name.  Specifically, return
 *  a promise which resolves to a Uint8Array containing the bytes of
 *  the image formatted for image format type.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_NAME:    name is invalid (contains a '/' or NUL-character).
 *    BAD_TYPE:    type is not one of the supported image types.
 *    NOT_FOUND:   there is no stored image for name under group.
 */
async function get(group, name, type) {
	var isError;

	//Check if the group name is valid or not
	isError = isBadGroup(group);
	if(!(isError === false))
		throw isError;

	//Check if the name passed is valid or not
	isError = isBadName(name)
	if(!(isError === false))
		throw isError;

	//Check if the extension passed is valid or not
	isError = isBadType(type)
	if(!(isError === false))
		throw isError;

	//Database code
	var db;
	var result;
	try
	{
		var mongoClient = require('mongodb').MongoClient;
		db = await mongoClient.connect(MONGO_URL + '/');
		var dbo = db.db(DB_NAME);

		//Database code for fetching the data
		result = await dbo.collection("images").find({group: group, name: name}, { _id : 0, data : 1 }).toArray();
	}
	catch(error)
	{
		throw(new ImgError('ERROR', 'error occurred in performing database operation'));
	}
	finally
	{
		//Closing the database connection
		db.close();
	}

	//Check if the image is present in the database
	if(result.length > 0)
	{
		//Getting the data length
		var dataLength = Object.keys(result[0].data).length;

		//Converting the data to Uint8Array
		var dataArray = new Uint8Array(dataLength);

		//Copying the contents in the Uint8Array
		for(var i = 0; i < dataLength; i++)
			dataArray[i] = result[0].data[i];

		//Check if type to be converted to is png, then convert ppm to png
		if(type === 'png')
		{
			var sys = require('util');
			var exec = require('child_process').execSync;
			var child;

			//Create temporary files for ppm and png
			var newPPMPath = os.tmpdir() + '/' + name + '.ppm';
			var newPNGPath = os.tmpdir() + '/' + name + '.png';

			//Converting Uint8Array to Buffer
			var buffer = Buffer.from(dataArray);

			//Write the buffer to Uint8Array
			const fileWrite = util.promisify(fs.writeFile);
			await fileWrite(newPPMPath, buffer);

			//Convert ppm to png
			child = exec("convert " + newPPMPath + " " + newPNGPath);

			//Read the png file contents
			const fileRead = util.promisify(fs.readFile);
			dataArray = await fileRead(newPNGPath);

			//Delete the ppm file
			fs.unlink(newPPMPath, (err) => {
			if(err) throw err;
			});

			//Delete the png file
			fs.unlink(newPNGPath, (err) => {
			if(err) throw err;
			});
		}
		return dataArray;
	}
	else
	{
		throw(new ImgError('NOT_FOUND', 'image not found'));
	}
}

/** Return promise which resolves to an array containing the names of
 *  all images stored under group.  The resolved value should be an
 *  empty array if there are no images stored under group.
 *
 *  The implementation of this function must not read the actual image
 *  bytes from the database.
 *
 *  Defined Errors Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 */
async function list(group) {
	var isError;

	//Check if the group name is valid or not
	isError = isBadGroup(group);
	if(!(isError === false))
		throw isError;

	//Database code
	var db;
	var result;
	try
	{
		var mongoClient = require('mongodb').MongoClient;
		db = await mongoClient.connect(MONGO_URL + '/');
		var dbo = db.db(DB_NAME);

		//Database code for fetching the data
		result = await dbo.collection("images").find({group: group}, { _id: 0, name: 1 }).toArray();
	}
	catch(error)
	{
		throw(new ImgError('ERROR', 'error occurred in performing database operation'));
	}
	finally
	{
		//Closing the database connection
		db.close();
	}

	//Set the names
	var data = [];
	for(var i = 0; i < result.length; i++)
	{
		if(result[i].name.trim().length > 0)
			data.push(result[i].name);
	}
	//Return the array containing data
	return data;
}

/** Return promise which resolves to an object containing
 *  meta-information for the image specified by group and name.
 *
 *  The return'd object must contain the following properties:
 *
 *    width:         a number giving the width of the image in pixels.
 *    height:        a number giving the height of the image in pixels.
 *    maxNColors:    a number giving the max # of colors per pixel.
 *    nHeaderBytes:  a number giving the number of bytes in the 
 *                   image header.
 *    creationTime:  the time the image was stored.  This must be
 *                   a number giving the number of milliseconds which 
 *                   have expired since 1970-01-01T00:00:00Z.
 *
 *  The implementation of this function must not read the actual image
 *  bytes from the database.
 *
 *  Defined Errors Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_NAME:    name is invalid (contains a '/' or NUL-character).
 *    NOT_FOUND:   there is no stored image for name under group.
 */
async function meta(group, name) {
	var isError;

	//Check if the group name is valid or not
	isError = isBadGroup(group);
	if(!(isError === false))
		throw isError;

	//Check if the name passed is valid or not
	isError = isBadName(name);
	if(!(isError === false))
		throw isError;

	//Database code
	var db;
	var result;
	try
	{
		var mongoClient = require('mongodb').MongoClient;
		db = await mongoClient.connect(MONGO_URL + '/');
		var dbo = db.db(DB_NAME);

		//Database code for fetching the data
		result = await dbo.collection("images").find({group: group, name: name}, { _id: 0, width: 1, height: 1, maxNColors: 1, nHeaderBytes: 1, creationTime: 1 }).toArray();
	}
	catch(error)
	{
		throw(new ImgError('ERROR', 'error occurred in performing database operation'));
	}
	finally
	{
		//Closing the database connection
		db.close();
	}

	//Check if the data is present
	if(result.length > 0)
	{
		var data = {width : result[0].width,
		 height: result[0].height,
		 maxNColors: result[0].maxNColors,
		 nHeaderBytes: result[0].nHeaderBytes,
		 creationTime: result[0].creationTime };

		return data
	}
	else
	{
		throw(new ImgError('NOT_FOUND', 'image not found'));
	}
}

/** Store the image specified by imgPath in the database under the
 *  specified group with name specified by the base-name of imgPath
 *  (without the extension).  The resolution of the return'd promise
 *  is undefined.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_FORMAT:  the contents of the file specified by imgPath does 
 *                 not satisfy the image format implied by its extension. 
 *    BAD_TYPE:    the extension for imgPath is not a supported type
 *    EXISTS:      the database already contains an image under group
 *                 with name specified by the base-name of imgPath
 *                 (without the extension). 
 *    NOT_FOUND:   the path imgPath does not exist.
 * 
 */
async function put(group, imgPath) {
	var isError;

	//Check if the group name is valid or not
	isError = isBadGroup(group);
	if(!(isError === false))
		throw isError;

	//Check if the image has a valid extension
	isError = isBadExt(imgPath);
	if(!(isError === false))
		throw isError;

	//Check if the image path exists or not
	isError = isBadPath(imgPath);
	if(!(isError === false))
		throw isError;

	//Promisifying the file read function
	const fileRead = util.promisify(fs.readFile);

	var data;
	try
	{
		//Check f the image is png
		if(pathToNameExt(imgPath)[1] === 'png')
		{
			var sys = require('util');
			var exec = require('child_process').execSync;
			var child;

			var newPath = os.tmpdir() + '/' + pathToNameExt(imgPath)[0] + '.ppm';

			//Convert the file from png to ppm format
			child = exec("convert " + imgPath + " " + newPath);

			//Read the file in ppm format
			data = await fileRead(newPath);

			//Remove temporary file
			fs.unlink(newPath, (err) => {
			if(err) throw err;
			});
		}
		else
		data = await fileRead(imgPath);
	}
	catch(error)
	{
		throw(new ImgError('ERROR', 'unable to read file'));
	}

	//Converting the data to Uint8Array
	var array = new Uint8Array(data);

	//Getting the image name and path
	var nameArray =  pathToNameExt(imgPath);

	//Creating a ppm object
	//var ppmObject = new Ppm(toImgId(group, nameArray[0], nameArray[1]), array);
	var ppmObject = new Ppm(toImgId(group, nameArray[0], ''), array);

	//Check if the object contains error
	if(!(typeof ppmObject.errorCode == "undefined"))
		throw ppmObject;

	//Database code
	var db;
	try
	{
		var mongoClient = require('mongodb').MongoClient;
		db = await mongoClient.connect(MONGO_URL + '/');
		var dbo = db.db(DB_NAME);

		var myobj = { _id: ppmObject.id, name: nameArray[0], group: group, data: ppmObject.bytes, width: ppmObject.width, height: ppmObject.height, maxNColors: ppmObject.maxNColors, nHeaderBytes: ppmObject.nHeaderBytes, creationTime: new Date().toISOString()};
		await dbo.collection("images").insertOne(myobj);
	}
	catch(error)
	{
		//Throw error if image already exists
		if(error.code === 11000)
			throw(new ImgError('EXISTS', 'database already contains an image under group with name specified'));
		else
			throw(new ImgError('ERROR', 'some database problem occurred'));
	}
	finally
	{
		//Closing the database connection
		db.close();
	}
	return;
}



//Utility functions

const NAME_DELIM = '/', TYPE_DELIM = '.';

/** Form id for image from group, name and optional type. */
function toImgId(group, name, type) {
  let v = `${group}${NAME_DELIM}${name}`;
  if (type) v += `${TYPE_DELIM}${type}`
  return v;
}

/** Given imgId of the form group/name return [group, name]. */
function fromImgId(imgId) {
  const nameIndex = imgId.lastIndexOf(NAME_DELIM);
  assert(nameIndex > 0);
  return [imgId.substr(0, nameIndex), imgId.substr(nameIndex + 1)];
}

/** Given a image path imgPath, return [ name, ext ]. */
function pathToNameExt(imgPath) {
  const typeDelimIndex = imgPath.lastIndexOf(TYPE_DELIM);
  const ext = imgPath.substr(typeDelimIndex + 1);
  const name = path.basename(imgPath.substr(0, typeDelimIndex));
  return [name, ext];
}

//Error utility functions

function isBadGroup(group) {
  return (group.trim().length === 0 || group.indexOf('\0') >= 0) &&
    new ImgError('BAD_GROUP', `bad image group ${group}`);
}

function isBadName(name) {
  return (name.trim().length === 0 ||
	  name.indexOf('\0') >= 0 || name.indexOf('/') >= 0) &&
    new ImgError('BAD_NAME', `bad image name '${name}'`);
}

function isBadExt(imgPath) {
  const lastDotIndex = imgPath.lastIndexOf('.');
  const type = (lastDotIndex < 0) ? '' : imgPath.substr(lastDotIndex + 1);
  return IMG_TYPES.indexOf(type) < 0 &&
    new ImgError('BAD_TYPE', `bad image type '${type}' in path ${imgPath}`);
}

function isBadPath(path) {
  return !fs.existsSync(path) &&
    new ImgError('NOT_FOUND', `file ${path} not found`);
}

function isBadType(type) {
  return IMG_TYPES.indexOf(type) < 0 &&
    new ImgError('BAD_TYPE', `bad image type '${type}'`);
}

/** Build an image error object using errorCode code and error 
 *  message msg. 
 */
function ImgError(code, msg) {
  this.errorCode = code;
  this.message = msg;
}
