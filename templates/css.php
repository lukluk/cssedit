<?php
ob_start();
?>
{{each(i,dec) decs}}
<div class="grabber"></div>
{{if dec.type == "dec"}}
<div class="dec" contenteditable="false">
	<div class="selector" contenteditable="true">${dec.selector}</div>
	<div class="properties">
		{{each(i,property) dec.properties}}
		<div class="property">
			<input type="checkbox" {{if property.disabled === false}} checked="checked" {{/if}} /><div class="name" contenteditable="true">${property.name}</div><div class="value" contenteditable="true">${property.value}</div>
		</div>
		{{/each}}
	</div>
</div>
{{else dec.type == "comment"}}
<div class="comment" contenteditable="true">${dec.text}</div>
{{/if}}
{{/each}}
<div class="grabber"></div>
<?php
$text = ob_get_clean();
echo $_GET['callback'] . "('". preg_replace('/(\n|\t|\s\s+)/','',$text)."')";