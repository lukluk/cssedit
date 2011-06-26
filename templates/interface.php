<?php
ob_start();
?>
<div id="header">
	<form action="#">
		<fieldset>
			<select id="cssedit_file" name="file">
				{{each(i,file) files}}
				<option value="${i}">${file}</option>
				{{/each}}
			</select>
		</fieldset>
	</form>
	<a id="sort"></a>
	<a id="save"></a>
	<a id="toggle_expand"></a>
</div>
<div id="stylesheet" contenteditable="false">

</div>
<?php
$text = ob_get_clean();
echo $_GET['callback'] . "('". preg_replace('/(\n|\t|\s\s+)/','',$text)."')";