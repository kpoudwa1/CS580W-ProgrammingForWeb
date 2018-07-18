//-*- mode: rjsx-mode;

'use strict';

(function() {

  /************************* Utility Functions **************************/

  /** Return url passed via ws-url query parameter to this script */
  function getWsUrl() {
    const params = (new URL(document.location)).searchParams;
    return params.get('ws-url');
  }


  /** Return contents of file (of type File) read from user's computer */
  async function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>  resolve(reader.result);
      reader.readAsText(file);
    });
  }



  /************************* Web Service Layer *************************/
  const DEFAULT_WS_URL = 'http://localhost:1234';

  const WS_URL = getWsUrl() || DEFAULT_WS_URL;

  class StegWs {

    constructor() {
      this.baseUrl = WS_URL;
      this.apiUrl = `${this.baseUrl}/api`;
	  this.imageSelect = '';
    }

    //TODO: add wrapper methods for accessing web services.
    //Adapt from prj4-sol.

	//Function for displaying images in inputs group for hiding message
	async hideList()
	{
		try
		{
			//For getting the list of the images with group name as 'inputs'
			var imagesList = await axios.get(this.apiUrl + '/images/inputs');
			var imagesArray = Array.from(imagesList.data);

			return imagesArray;
		}
		catch(err)
		{
			throw err;
		}
	}

	//Function for hiding the message in the selected image
	async processHide(data)
	{
		try
		{
			//Creating JSON object for web service call
			var requestData = {};
			requestData.outGroup = 'steg';
			//Check if the message is not blank
			if(data.msg.length > 0)
				requestData.msg = data.msg;
			
			//Calling the web service for hiding the message
			var result = await axios.post(this.apiUrl + '/steg/inputs/' + data.imageName, requestData);

			return result;
		}
		catch(err)
		{
			return {error: err};
		}
	}

	//Function for displaying images in steg group for unhiding message
	async unhideList()
	{
		try
		{
			//For getting the list of the images with group name as 'steg'
			var imagesList = await axios.get(this.apiUrl + '/images/steg');
			var imagesArray = Array.from(imagesList.data);

			return imagesArray;
		}
		catch(err)
		{
			throw err;
		}
	}

	//Function for unhiding the message from the selected image
	async processUnhide(data)
	{
		try
		{
			//Getting the hidden message from web service call
			var result = await axios.get(this.apiUrl + '/steg/steg/' + data.imageName);

			return result;
		}
		catch(err)
		{
			return {error: err};
		}
	}

  } //StegWs

  /*************************** Hide Component **************************/

  const HIDE_GROUP = 'inputs';

class Hide extends React.Component
{
	constructor(props)
	{
		super(props);
		//TODO other setup for Hide
		this.state = {formData: {}, formErrors: [], images: [], fileObj : {}};
		this.parentSubmit = props.onSubmit;
		this.onSubmit = this.onSubmit.bind(this);
	}

	//TODO other methods for Hide
	async componentDidMount()
	{
		await this.setHideList();
	}

	async setHideList()
	{
		try
		{
			const images = await this.props.ws.hideList();
			this.setState({images: images});
		}
		catch(err)
		{
			throw err;
		}
	}

		fileSelectedHandler = event => 
		{
			this.fileObj = event.target.files[0];
		}

	async onSubmit(event)
	{
		event.preventDefault();
		var isError = false;
		var formErrors = [];

		//Check if the image has been selected or not
		if(event.target.images.value.length == 0)
		{
			formErrors.push('Please select an image');
			isError = true;
		}

		//Check if the message has been selected or not
		if(event.target.MessageChoice.value.length == 0)
		{
			formErrors.push('Please select an option for entering the message');
			isError = true;
		}

		//Set the errors
		if(isError === true)
			this.setState({formErrors: formErrors});
		else
		{
			//Clear the errors if there are any
			this.setState({formErrors: []});
			var data = {};
			data.imageName = event.target.images.value;

			//Setting the message
			if(event.target.MessageChoice.value === "text")
				data.msg = event.target.message.value;
			else if(this.fileObj == undefined || this.fileObj == null)
			{
				formErrors.push('Please select a file containing message');
				this.setState({formErrors: formErrors});
				isError = true;
			}
			else if(this.fileObj != undefined && this.fileObj != null)
				data.msg = await readFile(this.fileObj);
			
			if(isError !== true)
			{
				//data.msg = event.target.message.value;
				var status = await this.props.ws.processHide(data);		
				if(!(typeof status.error == "undefined"))
				{
					formErrors.push(status.error.response.data.message);
					this.setState({formErrors: formErrors});
				}
				else
				{
					this.props.app.select('unhide');
				}
			}
		}
	}

	render()
	{
		//TODO rendering code

		//Steg object
		var stegObj = new StegWs();

		var urlPrefix = stegObj.apiUrl;
		return (
		<div>
			<div className="error">
			{
				this.state.formErrors.map(x =>
					<ul>{x}</ul>
				)
			}
			</div>
			<form onSubmit={this.onSubmit}  enctype="multipart/form-data">
			<div className = "container">
				<table border ="1px"  width="200px" cellPadding="0">
				{
					this.state.images.map(x =>
						<tr>	
							<td>
								<input type="radio" name="images" value={x}/>
							</td>
							<td align="center" valign="center" border ="0px">
								<img src = {urlPrefix + '/images/inputs/' + x  + '.png'} />
								<br />
								{x}
							</td>
						</tr>
					)
				}
				</table>
			</div>
			<div>
				<h2>Please enter message here</h2>
				<table border ="1px"  width="200px" cellPadding="0">
					<tr>
						<td><input type="radio" name="MessageChoice" value="text" /></td>
						<td>Message:<br/><textarea name="message" rows= "5" width = "200" text = "" placeholder="Enter message here..."></textarea><br/></td>
					</tr>
					<tr>
						<td><input type="radio" name="MessageChoice" value="file" /></td>
						<td><input name="uploadedMessage" type="file" onChange={this.fileSelectedHandler} /></td>
					</tr>
				</table>
				<input type="submit" value="Submit" />
			</div>
		</form>
		</div>
		);
    }

}

  /************************** Unhide Component *************************/

class Unhide extends React.Component
{
	constructor(props)
	{
		super(props);
		//TODO other setup for Unhide
		this.state = {formData: {}, formErrors: [], images: []};
		this.parentSubmit = props.onSubmit;
		this.onSubmit = this.onSubmit.bind(this);
	}

	//TODO other methods for Unhide
	async componentDidMount()
	{
		await this.setUnhideList();
	}

	async setUnhideList()
	{
		try
		{
			const images = await this.props.ws.unhideList();
			this.setState({images: images});
		}
		catch(err)
		{
			throw err;
		}
	}

	async onSubmit(event)
	{
		event.preventDefault();

		var isError = false;
		var formErrors = [];

		//Check if the image has been selected or not
		if(event.target.images.value.length == 0)
		{
			formErrors.push('Please select an image');
			isError = true;
		}

		//Set the errors
		if(isError === true)
			this.setState({formErrors: formErrors});
		else
		{
			//Clear the errors if there are any
			this.setState({formErrors: []});
			var data = {};
			data.imageName = event.target.images.value;
			var status = await this.props.ws.processUnhide(data);
			if(!(typeof status.error == "undefined"))
			{
				formErrors.push(status.error.response.data.message);
				this.setState({formErrors: formErrors});
			}
			else
			{
				formErrors.push('Hidden Message: ' + status.data.msg);
				this.setState({formErrors: formErrors});
			}
		}
	}

	render()
	{
		//TODO rendering code

		//Steg object
		var stegObj = new StegWs();

		var urlPrefix = stegObj.apiUrl;

		return (
		<div>
			<div className="error">
			{
				this.state.formErrors.map(x =>
					<ul>{x}</ul>
				)
			}
			</div>
		<form onSubmit={this.onSubmit}>
			<div className = "container">
				<table border ="1px"  width="200px" cellPadding="0">
				{
					this.state.images.map(x =>
						<tr>	
							<td>
								<input type="radio" name="images" value={x}/>
							</td>
							<td align="center" valign="center" border ="0px">
								<img src = {urlPrefix + '/images/steg/' + x  + '.png'} />
								<br />
								{x}
							</td>
						</tr>
					)
				}
				</table>
				<input type="submit" value="Submit" />
			</div>
		</form>
		</div>
		);
    }
}


  /*************************** Tab Component ***************************/

  function Tab(props) {
    const id = props.id;
    const tabbedId = `tabbed${props.index}`;
    const checked = (props.index === 0);
    return (
      <section className="tab">
        <input type="radio" name="tab" className="tab-control"
               id={tabbedId} checked={props.isSelected}
               onChange={() => props.select(id)}/>
        <h1 className="tab-title">
          <label htmlFor={tabbedId}>{props.label}</label>
        </h1>
        <div className="tab-content" id={props.id}>
          {props.component}
        </div>
      </section>
    );
  }

  /*************************** App Component ***************************/

  class App extends React.Component {

    constructor(props) {
      super(props);

      this.select = this.select.bind(this);
      this.isSelected = this.isSelected.bind(this);

      this.state = {
        selected: 'hide',
        hide: <Hide ws={props.ws} app={this}/>,
        unhide: <Unhide ws={props.ws} app={this}/>
      };

    }

    //top-level error reporting; produces slightly better errors
    //in chrome console.
    componentDidCatch(error, info) {
      console.error(error, info);
    }

    isSelected(v) { return v === this.state.selected; }

    /** select tab v: 'hide' or 'unhide'. */
    select(v) {
      this.setState({selected: v});
      const rand = Math.random();  //random key to force remount; not performant
      let component;
      switch (v) {
        case 'hide':
          component = <Hide ws={this.props.ws} app={this} key={rand}/>;
        break;
        case 'unhide':
          component = <Unhide ws={this.props.ws} app={this} key={rand}/>;
        break;
      }
      this.setState({ [v]: component });
    }

    render() {
      const tabs = ['hide', 'unhide'].map((k, i) => {
        const component = this.state[k];
        const label = k[0].toUpperCase() + k.substr(1);
        const isSelected = (this.state.selected === k);
        const tab = (
          <Tab component={component} key={k} id={k}
               label={label} index={i}
               select={this.select} isSelected={isSelected}/>
        );
        return tab;
      });

      return <div className="tabs">{tabs}</div>
    }

  }

  /*************************** Top-Level Code **************************/

  function main() {
    const ws = new StegWs();
    const app = <App ws={ws}/>;
    ReactDOM.render(app, document.getElementById('app'));
  }

  main();

})();
