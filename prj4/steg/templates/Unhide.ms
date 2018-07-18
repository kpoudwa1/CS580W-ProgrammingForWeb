<!DOCTYPE html>
<html>
	<head>
		<title>Hide Page</title>
		<style>
			.container {
			width:100px;
			}

			.container img {
			object-fit: contain;
			max-width: 100%;
			max-height: 100%;
			width: auto;
			height: auto;
			}
		</style>
	</head>
	<body>
		<h1>Unhide messages</h1>
		<div style="background-color:#ff3300;color:##661400">
		{{#errors}}
			<h2>Error</h2>
			<ul>
			<h3>Status: {{status}}</h3>
			<h3>Code: {{code}}</h3>
			<h3>Message: {{message}}</h3>
			<ul>
		{{/errors}}
		</ul>
		</div>
		{{#formdata}}
		<form method="POST" action="/performUnhide">
		<div class="container">
		<table border ="1px"  width="200px" cellpadding="0">

		{{#images}}
		<tr>
			<td>
				<input type="radio" name="images" value="{{img_name}}" {{#checked}} checked {{/checked}}>
			</td>
			<td align="center" valign="center" border ="0px">
				<img src = "{{img_bytes}}"/>
				<br />
				{{img_name}}
			</td>
		</tr>
		{{/images}}

		</table>
		</div>
		<input type="submit" value="Submit">
		</form>
		{{/formdata}}
		<hr/>
		<a href="/index.html">Return to home page</a>
	</body>
</html>
