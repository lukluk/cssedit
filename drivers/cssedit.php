<?php
/*
This file is to accept reqeusts from cssedit and update your css files.
It should be placed at the root of your website and removed before your website
goes live.
*/

error_reporting(E_ALL | E_STRICT);
$base = realpath(dirname(__FILE__)).DIRECTORY_SEPARATOR;

if (empty($_POST['file']) || empty($_POST['css'])){
	echo
	  '<!DOCTYPE html>'
	. '<html>'
	. '<head>'
		. '<title>CSSEdit</title>'
	. '</head>'
	. '<body>'
		. 'Storing needed values. You should now be able to use cssedit.'
		. '<script type="text/javascript">'
			. 'localStorage.setItem("cssedit_path", "' . $_SERVER['PHP_SELF'] . '");'
		. '</script>'
	. '</body>'
	. '</html>';
}
else{
	$parts = parse_url($_POST['file']);
	$file = (isset($parts['path']) ? $_SERVER['DOCUMENT_ROOT'] . $parts['path'] : false);
	$css = $_POST['css'];

	// Try and find the file
	
	if ($file && file_exists($file)){
		$fh = fopen($file,'w');
		fwrite($fh, $css);
		fclose($fh);
	}
	else{
		throw new ErrorException('CSS file not found.' . $file);
	}
}