#!/usr/bin/env nodejs

'use strict';

const Ppm = require('./ppm');

/** prefix which always precedes actual message when message is hidden
 *  in an image.
 */
const STEG_MAGIC = 'stg';

/** Constructor which takes some kind of ID and a Ppm image */
function StegModule(id, ppm) {
  this.id = id;
  this.ppm = ppm;
}

/** Hide message msg using PPM image contained in this StegModule object
 *  and return an object containing the new PPM image.
 *
 *  Specifically, this function will always return an object.  If an
 *  error occurs, then the "error" property of the return'd object
 *  will be set to a suitable error message.  If everything ok, then
 *  the "ppm" property of return'd object will be set to a Ppm image
 *  ppmOut which is derived from this.ppm with msg hidden.
 *
 *  The ppmOut image will be formed from the image contained in this
 *  StegModule object and msg as follows.
 *
 *    1.  The meta-info (header, comments, resolution, color-depth)
 *        for ppmOut is set to that of the PPM image contained in this
 *        StegModule object.
 *
 *    2.  A magicMsg is formed as the concatenation of STEG_MAGIC,
 *        msg and the NUL-character '\0'.
 *
 *    3.  The bits of the character codes of magicMsg including the
 *        terminating NUL-character are unpacked (MSB-first) into the
 *        LSB of successive pixel bytes of the ppmOut image.  Note
 *        that the pixel bytes of ppmOut should be identical to those
 *        of the image in this StegModule object except that the LSB of each
 *        pixel byte will contain the bits of magicMsg.
 *
 *  The function should detect the following errors:
 *
 *    STEG_TOO_BIG:   The provided pixelBytes array is not large enough 
 *                    to allow hiding magicMsg.
 *    STEG_MSG:       The image contained in this StegModule object may already
 *                    contain a hidden message; detected by seeing
 *                    this StegModule object's underlying image pixel bytes
 *                    starting with a hidden STEG_MAGIC string.
 *
 * Each error message must start with the above IDs (STEG_TOO_BIG, etc).
 */
StegModule.prototype.hide = function(msg) {
  //TODO: hide STEG_MAGIC + msg + '\0' into a copy of this.ppm
  //construct copy as shown below, then update pixelBytes in the copy.

	//Execute the unhide method to check if the image contains a hidden message
	var unhideMessage = this.unhide();

	//Return object
	var outppm = new Ppm(this.ppm);

	//Check if the image already contains a hidden message
	//Link reffered for processing JSON key https://stackoverflow.com/questions/20804163/check-if-a-key-exists-inside-a-json-object
	if(!(typeof unhideMessage.error == "undefined"))
	{
		//Getting the max length of message
		var maxMsgSize = Math.floor(((outppm.width * outppm.height * 3) / 8) - 3) - 1;

		//Check the length of the message
		if(msg.length <= maxMsgSize)
		{
			//Append STEG_MAGIC to message
			msg = STEG_MAGIC + msg

			//Binary string containing the entire message
			var binaryString = '';

			//Convert the message to binary
			for(var i = 0; i < msg.length; i++)
			{
				var tempBinaryString = msg.charCodeAt(i).toString(2);

				//For padding zeros to make the length of the binary representation as 8
				while(tempBinaryString.length !== 8)
					tempBinaryString = '0' + tempBinaryString;

				binaryString += tempBinaryString;
			}

			//For appending '\0'
			binaryString += '00000000';

			//Hiding the message in the pixel bytes
			for(var i = 0; i < binaryString.length; i++)
			{
				if(binaryString[i] === '1')
					outppm.pixelBytes[i] = outppm.pixelBytes[i] | 1;
				else
					outppm.pixelBytes[i] = outppm.pixelBytes[i] & ~1;
			}

			//Return the image containing hidden message
			return { ppm: outppm };
		}
		else//Error, message size is too big to be hidden in the image
		{
			return { error : 'STEG_TOO_BIG: ' + this.id.substring(this.id.lastIndexOf('/') + 1) + ': message too big to be hidden in image'};
		}
	}
	else//Error, the image already contains hidden message
	{
		return { error : 'STEG_MSG: ' + this.id.substring(this.id.lastIndexOf('/') + 1) + ': image already contains a hidden message'};
	}
}

/** Return message hidden in this StegModule object.  Specifically, if
 *  an error occurs, then return an object with "error" property set
 *  to a string describing the error.  If everything is ok, then the
 *  return'd object should have a "msg" property set to the hidden
 *  message.  Note that the return'd message should not contain
 *  STEG_MAGIC or the terminating NUL '\0' character.
 *
 *  The function will detect the following errors:
 *
 *    STEG_NO_MSG:    The image contained in this Steg object does not
 *                    contain a hidden message; detected by not
 *                    seeing this Steg object's underlying image pixel
 *                    bytes starting with a hidden STEG_MAGIC
 *                    string.
 *    STEG_BAD_MSG:   A bad message was decoded (the NUL-terminator
 *                    was not found).
 *
 * Each error message must start with the above IDs (STEG_NO_MSG, etc).
 */
StegModule.prototype.unhide = function() {
	var message = '';
	var binaryData = '';
	var nullFlag = 0;

	//Processing the pixel bytes of the code
	for(var i = 0; i < this.ppm.pixelBytes.length; i++)
	{
		//Converting the pixel byte to hex
		var hexCharacter = this.ppm.pixelBytes[i].toString(16);
		hexCharacter = (hexCharacter.length === 1) ? '0' + hexCharacter : hexCharacter;

		//Getting the LSB  from each byte and converting it to binary
		if(hexCharacter[1] === '0' || hexCharacter[1] === '2' || hexCharacter[1] === '4' || hexCharacter[1] === '6' || hexCharacter[1] === '8' || hexCharacter[1] === 'a' || hexCharacter[1] === 'c' || hexCharacter[1] === 'e')
		{
			binaryData += '0';
		}
		else
		{
			binaryData += '1';
		}

		//Check if the binary byte (string) contains 8 bits and the converting the 8 bits to ascii character
		if(binaryData.length === 8)
		{
			//Converting binary to hex
			var hexNo = '0x' + parseInt(binaryData, 2).toString(16);
			message += String.fromCharCode(parseInt(hexNo, 16));

			//Reseting the binary byte(8 bits)
			binaryData = '';

			//Break the loop if a NULL terminator occurs
			if(String.fromCharCode(parseInt(hexNo, 16)) === '\0')
			{
				nullFlag = 1;
				break;
			}
		}
	}

	//Processing response
	if(message.indexOf(STEG_MAGIC) == -1)
	{
		//Image does not contain data
		return { error : 'STEG_NO_MSG: ' + this.id.substring(this.id.lastIndexOf('/') + 1) + ': image does not have a message'};
	}
	else if(nullFlag === 0)
	{
		//The null terminator was not found
		return { error : 'STEG_BAD_MSG: ' + this.id.substring(this.id.lastIndexOf('/') + 1) + ': bad message'};
	}
	else
	{
		//Replacing the 'STEG_MAGIC'
		message = message.replace('stg', '');
		return { msg : message};
	}

}


module.exports = StegModule;
