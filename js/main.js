(function($){

var c = {};
var url = 'http://localhost/cssedit/';
c.indexes = {};
c.container = $('body'); // Container we are rendering to
c.files = []; // All known CSS files
c.stylesheets = {};
c.ss = false; // Quick access to current stylesheet
c.document = false;

c.init = function(){
	// If we are in an iframe find it and resize it
	if (window.parent !== window){
		c.document = window.parent.document;
		$(window.parent.document).find('iframe').each(function(i,e){
			if (e.contentDocument === document){
				$(e).css({
					'position':'fixed'
					,'bottom':0
					,'left':0
					,'width':'100%'
					,'height':'400px'
					,'border':0
				});
			}
		});
	}
	// If we are in a popup
	else if (window.opener !== null){
		c.document = window.opener.document;
	}

	// Find CSS files that we will be working with.
	// CSS files will be limited by same-origin policy so make sure they are
	// on the same domain.
	c.files = c.getFiles();
	
	// Get templates
	$.getJSON(url + 'templates/interface.php?callback=?', function(data){
		$.template('interface',data);
		$.tmpl('interface',{files: c.files}).appendTo(c.container);
		
		$('#toggle_expand').button({icons:{primary: 'ui-icon-newwin'}}).click(function(){
			if (window.parent !== window){
				var page = window.open('about:blank','CSSEdit','menubar=no,toolbar=no,location=no,personalbar=no,status=no,dependent=yes,scrollbars=yes');
				var onloaded = false;
				page.onload = function(){
					c.move(page);
				}
				
				if (!onloaded && page.document.readyState === 'complete') page.onload();
			}
			else{
				var iframe = c.document.createElement('iframe');
				iframe.setAttribute('src','about:blank');
				iframe.onload = function(){
					c.move(iframe.contentWindow);
				}
				c.document.body.appendChild(iframe);
				
			}
		});
			
		$('#save').button({icons: {primary: 'ui-icon-disk'}}).click(function(e){
			c.ss.save();
		});
		
		// Events for dropdown menu to change stylesheets
		$('#cssedit_file').change(function(e){
			var url = c.files[ $(e.target).val() ];
			c.display(url);
		});

		$.getJSON(url + 'templates/css.php?callback=?', function(data){
			$.template('css', data);
			
			// Auto display the first CSS file
			c.display(c.files[0]);
		});
	});
	
	// Setup events

	// Right clicking things
	$('#stylesheet').live('contextmenu mousedown mouseup', function(e){
		if (e.which === 3){
			e.preventDefault();
			
			// In firefox in no contenteditable element is focus it will select everything
			var target = $(e.target);
			if (target.attr('class') === 'selector') target.focus();
			else if (target.attr('class') === 'dec') target.find('.selector').focus();
			else if (target.attr('class') === 'property') target.find('.name').focus();
			else if (target.attr('id') === 'stylesheet') $('.selector:eq(0)').focus();
			
			if (e.type == 'mouseup'){
			
				// Show menu to delete/insert property
				if(target.is('.property,.name,.value')){
					var menu = $('<div />',{'class':'cssedit_menu'})
					.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
					.appendTo('body')
					.mouseleave(function(e){
						$(this).remove();
					});
					
					$('<a />').text('Delete')
					.appendTo(menu)
					.button()
					.bind('click',{property: target.closest('.property')}, function(e){
						$(e.target).parent().parent().remove();
						var prop = e.data.property.index()
							,dec = e.data.property.closest('.dec').index('.dec,.comment');
						c.ss.styles[dec].properties[prop].deleted = true;
						c.ss.update_template();
						c.ss.update_element();
						e.data.property.remove();
					});
					
					$('<a />')
					.text('Insert')
					.appendTo(menu)
					.button()
					.bind('click',{target: target}, function(e){
						e.data.target.trigger('add_property');
					});
				}
				
				// Show menu to insert dec/comment
				else if (target.is('.grabber')){
					var menu = $('<div />',{'class':'cssedit_menu'})
					.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
					.appendTo('body')
					.mouseleave(function(e){
						$(this).remove();
					});
					
					$('<a />').text('Add comment').button()
					.bind('click',{target: target}, function(e){
						$(e.target).parent().parent().remove();
						$(e.data.target).trigger('add_comment');
					})
					.appendTo(menu);

					$('<a />').text('Add declaration').button()
					.bind('click',{target: target}, function(e){
						$(e.target).parent().parent().remove();
						$(e.data.target).trigger('add_dec');
					})
					.appendTo(menu);
				}
				
				// Show menu to remove comments
				else if (target.is('.comment')){
					var menu = $('<div />',{'class':'cssedit_menu'})
					.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
					.appendTo('body')
					.mouseleave(function(e){
						$(this).remove();
					});
					
					$('<a />').text('Delete comment').button()
					.bind('click',{target: target}, function(e){
						$(e.target).parent().parent().remove();
						$(e.data.target).trigger('delete_comment');
					})
					.appendTo(menu);
				}
			}
		}
	});
	
	// Prevent new lines
	$('.selector, .value, .property','.dec').live('keypress', function(e){
		return e.which != 13;
	});
	
	$('.dec .selector').live('keyup', function(e){
		// Pressing enter on a selector for a dec with no properties adds
		// a property
		if (e.which === 13){
			var next = $(e.target).parent().find('.properties .property:eq(0)');
			if (next.length > 0){
				next.focus();
			}
			else{
				$(e.target).parent().find('.properties').trigger('add_property');
			}
		}
		
		// Else update object
		else{
			var index = $(e.target).parent('.dec').index('.dec,.comment');
			c.ss.styles[index].selector = $(e.target).text();
			c.ss.update_element();
		}
	});
	
	// Changing comment
	$('.comment').live('keyup',function(e){
		var index = $(e.target).index('.dec,.comment');
		c.ss.styles[index].text = $(e.target).html().replace(new RegExp('<br>', 'gi'), "\n");
	});
	
	// Value/name navigation
	$('.dec .name,.dec .value').live('keyup',function(e){
		if(e.which === 13){
			var type = $(e.target).attr('class')
				,next = (type == 'property' ? $(e.target).next().next() : $(e.target).next());
				
			// Add a new property/value set
			if(next.length == 0){
				$(e.target).trigger('add_property');
			}
			// Go to the next property
			else{
				next.focus();
			}
		}
		else{
			var dec = $(e.target).closest('.dec').index('.dec,.comment')
				,prop = $(e.target).parent().index()
				,type = $(e.target).attr('class');
			c.ss.styles[dec].properties[prop][type] = $(e.target).text();
			c.ss.update_element();
		}
	});
	
	// Auto remove empty properties
	$('.dec .property').live('focusout',function(e){
		if($(e.target).closest('.property').text() === ''){
			$(e.target).parent().remove();
		}
	});
	
	// Auto remove empty comments
	$('.comment').live('keyup',function(e){
		if ( $.trim($(e.target).text()) === '') $(e.target).trigger('delete_comment');
	});
	
	// Enable/disable property
	$('.dec input[type="checkbox"]').live('change',function(e){
		var dec = $(e.target).closest('.dec').index('.dec,.comment')
			,prop = $(e.target).parent().index()
			,disabled = !e.target.checked
		c.ss.styles[dec].properties[prop].disabled = disabled;
		c.ss.update_element();
	});
	// Press insert to insert property at current location
	$('.property').live('keyup',function(e){
		if (e.which === 45) $(e.target).trigger('add_property');
	});
	
	// Add property after e.target
	$('.properties').live('add_property',function(e){
		var dec = $(e.target).closest('.dec').index('.dec,.comment');
		var target = $(e.target);
		if (target.is('.properties')){
			var prop = 0;
			var wrap = $('<div />',{'class':'property'}).appendTo(target);
		}
		else if (target.is('.property,.name,.value')){
			var prop = $(e.target).closest('.property').index()+1;
			var wrap = $('<div />',{'class':'property'}).insertAfter(target.parent());
			
		}
		c.ss.styles[dec].properties.splice(prop,0,{
			name: ''
			,value: ''
			,disabled: false
		});
		c.ss.update_template();
		c.ss.update_element();
		
		$('<input />',{'type': 'checkbox','checked':'checked'}).appendTo(wrap);
		$('<div />',{'class': 'name','contenteditable':'true'}).appendTo(wrap).focus();
		$('<div />',{'class': 'value','contenteditable':'true'}).appendTo(wrap);
	});
	
	// Add comment after e.target
	$('.grabber').live('add_comment',function(e){
		var target = $(e.target)
			,index = target.prev().index('.dec,.comment')+1;
		c.ss.styles.splice(index,0,{
			type: 'comment'
			,text: ''
		});
		c.ss.update_template();
		
		$('<div />',{'class':'grabber'}).insertAfter(target);
		$('<div />',{'class':'comment','contenteditable':'true'}).insertAfter(target).focus();
	});
	
	// Add dec after e.target
	$('.grabber').live('add_dec',function(e){
		var target = $(e.target)
			,index = target.prev().index('.dec,.comment')+1;
		
		c.ss.styles.splice(index,0,{
			type: 'dec'
			,selector: ''
			,properties: []
		});
		c.ss.update_template();
		
		$('<div />',{'class':'grabber'}).insertAfter(target);
		var dec = $('<div />',{'class':'dec','contenteditable':'false'}).insertAfter(target);
		
		$('<div />',{'class':'selector','contenteditable':'true'}).appendTo(dec).focus();
		
		var props = $('<div />',{'class':'properties'}).appendTo(dec);
		
	});
	
	// Delete comment
	$('.comment').live('delete_comment',function(e){
		var target = $(e.target);
		var index = target.index('.dec,.comment');
		c.ss.styles[index].deleted = true;
		c.ss.update_template();
		target.next('.grabber').andSelf().remove();
	});
	
	// Skip over checkboxes when tabbing through things
	$('#stylesheet input:checkbox').live('keyup',function(e){
		if (e.which === 9){
			if (e.shiftKey === false) $(this).next().focus();
			else $(this).parent().prev().find('.value').focus();
		}
	});
	
	// Increment numeric values using up/down arrow keys
	$('.value').live('keydown',function(e){
		var target = $(this);
		
		// Get what is at cursor location
		var offset = window.getSelection().getRangeAt(0).startOffset
			,regex = new RegExp('(.{0,'+offset+'})(\\s|^)(-{0,1}[\\d]+)([\\w]*)(\\s|$)')
			,unit = target.text().match(regex);
		
		if(unit !== null && unit[3].length > 0){
			var i = parseInt(unit[3]);
			var number;
			if (e.shiftKey === false) number = 1;
			else number = 10;
			
			if (e.which === 38) i += number;
			else if (e.which === 40) i -= number;
			else return;
		
			target.text( target.text().replace(regex, '$1$2'+i+ (unit[4] || 'px') +'$5'));
			var range = document.createRange();

			range.setStart(this.firstChild,offset);
			range.setEnd(this.firstChild,offset);
			
			var sel = window.getSelection();
			e.preventDefault();
			sel.removeAllRanges();
			sel.addRange(range);
		}
	});
	
	// ctrl+s saves current stylesheet
	$(window).bind('keydown', function(e){
		if (e.which === 83 && e.metaKey === true){
			e.preventDefault();
			
			c.ss.save();
		}
	});
}

c.getFiles = function(){
	var files = []
		,our_css = ['css/master.css']
	$('link[href][type="text/css"]',c.document).each(function(i,e){
		var href = $(this).attr('href');
		if ($.inArray(href, our_css) === -1) files.push( href );
	});
	
	return files;
}

c.display = function(url){
	if (typeof c.stylesheets[url] === 'undefined'){
		c.stylesheets[url] = new ss(url);
	}
	
	// Generate css display if there were no errors
	$('#stylesheet').html( $.tmpl('css', {decs: c.stylesheets[url].styles}) );

	c.ss = c.stylesheets[url];
}

c.move = function(target){
	var head = target.document.head;
		
	var scripts = ['js/jquery-1.5.2.js','js/jquery-ui-1.8.11.custom.min.js','js/jquery.tmpl.js','js/main.js'];
	var styles = ['css/master.css','css/theme/jquery-ui-1.8.11.custom.css'];
	
	for (i in styles){
		var style = target.document.createElement('link');
		style.setAttribute('type','text/css');
		style.setAttribute('rel','stylesheet');
		style.setAttribute('href',url+styles[i]);
		head.appendChild(style);
	}
	
	// Load jQuery into new document
	for (i in scripts){
		var script = target.document.createElement('script');
		script.setAttribute('type','text/javascript');
		script.setAttribute('src',url + scripts[i]);
		script.async = false;
		head.insertBefore(script, head.firstChild);
	}
	
	// Chrome doesn't seem to like script.onload so check for existance of cssedit
	var inter = setInterval(function(){
		if (typeof target.cssedit !== 'undefined'){
			target.cssedit.files = c.files;
			target.cssedit.stylesheets = c.stylesheets;
			target.cssedit.document = c.document;
			target.cssedit.window = c.window;
			target.cssedit.init();
			
			// Display current css file
			target.cssedit.display(c.ss.url);
			
			// Remove our current view
			c.destruct();
			clearInterval(inter);
		}
	},1);
}

c.destruct = function(){
	// If we are in an iframe find it and remove it
	if (window.parent !== window){
		c.document = window.parent.document;
		$(window.parent.document).find('iframe').each(function(i,e){
			if (e.contentDocument === document){
				$(e).remove();
			}
		});
	}
	// If we are in a popup close it
	else{
		window.close();
	}
}

var ss = c.StyleSheet = function(url){
	
	// url of stylesheet
	this.url = url;
	var css = '';
	$.ajax({
		async: false
		,url: this.path()
		,cache: false
		,success: function(data){
			css = data;
		}
	});
	
	this.css = css;
	
	// Where we will be updating the css
	this.styleObject = $('<style />',{type: 'text/css'}).appendTo(c.document.head);
	
	this.indexes = {}; // Indexes for template
	this.indexes.selector = 0;
	this.indexes.prop     = 0;
	this.indexes.value    = 0;
	
	this.template  = ''; // Template for rendering
	this.styles = []; // Parsed styles from this.css
	
	// Setup everything
	this.parse();
	this.styleObject.html( this.render() );
	
	// Remove link to original stylesheet
	$('link[href="'+url+'"]',c.document).remove();
	
	return this;
}

ss.fn = ss.prototype;

ss.fn.parse = function(){
	var obj = []
		,css = this.css
		,in_dec       = false
		,in_comment   = false
		,in_property  = false
		,in_value     = false
		,disabled     = false
		,selector     = ''
		,properties   = []
		,property     = ''
		,value        = ''
		,place_holder = ''
		,current = ''
		,selector_index = 0
		,prop_index = 0
		,value_index = 0
		,comment_index = 0;
	
	// Start processing css
	// start with decs
	
	for(var i = 0; i < css.length; i++){
		var c = css[i];
		current += c;
		// Look for the start of decs and comments
		if(in_dec === false && in_comment === false){
			if (c === '{'){
				place_holder += current.replace($.trim(selector), '$selector'+selector_index);
				current = '';
				in_dec = true;
				in_property = true;
				continue;
			}
			else if (c === '/' && css[(i*1)+1] === '*'){
				current += css[(i*1)+1];
				in_comment = true;
				i++;
				continue;
			}
		}
		
		// Look for the end of decs
		if (in_dec === true && c === '}'){
			if (property !== '' && value !== ''){
				properties.push({
					name: $.trim(property)
					,value: $.trim(value)
					,prop_index: prop_index++
					,value_index: value_index++
					,disabled: disabled
				});
			}
			obj.push({
				type: 'dec'
				,selector: $.trim(selector)
				,selector_index: selector_index++
				,properties: properties
			});
			place_holder += current;
			in_comment = in_dec = in_property = in_value = false;
			current = selector = property = value = '';
			properties = [];
			continue;
		}
		// Look for the start of comments inside decs
		else if (in_dec === true && c === '/' && css[(i*1)+1] === '*'){
			current = current.substring(0,current.length-1);
			disabled = true;
			i++;
			continue;
		}
		// Look for the end of comments inside decs
		else if (in_dec === true && c === '*' && css[(i*1)+1] === '/'){
			current = current.substring(0,current.length-1);
			disabled = false;
			i++;
			continue;
		}
		// Look for the end of comments
		else if (in_comment === true && c === '*' && css[(i*1)+1] === '/'){
			current += css[(i*1)+1];
			place_holder += current.replace(value, '$property'+prop_index);
			obj.push({
				type: 'comment'
				,text: value
				,index: prop_index++
			});
			in_comment = in_dec = in_property = in_value = false;
			current = selector = property = value = '';
			properties = [];
			i++;
			continue;
		}
		
		if (in_dec === false && in_comment === false){
			selector += c;
		}
		else if (in_comment){
			value += c;
		}
		else if (in_dec === true){
			if (in_property === true){
				if (c === ':'){
					place_holder += current.replace($.trim(property), '$property'+prop_index);
					current = '';
					in_property = false;
					in_value = true;
				}
				else{
					property += c;
				}
			}
			else if (in_value === true){
				if (c === ';'){
					place_holder += current.replace($.trim(value), '$value'+value_index);
					properties.push({
						name: $.trim(property)
						,prop_index: prop_index++
						,value_index: value_index++
						,value: $.trim(value)
						,disabled: disabled
					});
					current = property = value = '';
					in_value = false;
					in_property = true;
				}
				else{
					value += c;
				}
			}
		}
	}
	this.indexes.selector = selector_index;
	this.indexes.prop     = prop_index;
	this.indexes.value    = value_index;
	this.template  = place_holder += current;
	this.styles = obj;
	
	return this;
}

ss.fn.update_template = function(){
	var template = this.template;
	var obj = this.styles;
	
	// Get last indexes
	selector_index = this.indexes.selector;
	prop_index     = this.indexes.prop;
	value_index    = this.indexes.value;

	for (i in obj){
		var e = obj[i];
		
		if (e.type === 'dec' && typeof e.selector_index === 'undefined'){
			// Insert comment after the last thing
			var prev = obj[i-1];
			var regex = '';

			if (prev.type === 'dec'){
				regex = ''
				+ '(\\$selector' + prev.selector_index +')'
				+ '([^}]+})'
				+ '(\\s*)';
			}
			else if (prev.type === 'comment'){
				regex = ''
				+ '(\\$property' + prev.index +')'
				+ '([^]*?\\*/)'
				+ '(\\s*)';
			}
			
			
			var m = template.match(new RegExp(regex));
			var string = '$selector'+selector_index+'{}';
			e.selector_index = selector_index++;
			template = template.replace(m[0], m[1]+m[2]+m[3]+string+m[3]);
		}
		else if (e.type === 'comment' && typeof e.index === 'undefined'){
			// Insert comment after the last thing
			var prev = obj[i-1];
			var regex = '';

			if (prev.type === 'dec'){
				regex = ''
				+ '(\\$selector' + prev.selector_index +')'
				+ '([^}]+})'
				+ '(\\s*)';
			}
			else if (prev.type === 'comment'){
				regex = ''
				+ '(\\$property' + prev.index +')'
				+ '([^]*?\\*/)'
				+ '(\\s*)';
			}
			var m = template.match(new RegExp(regex));
			var string = '/*$property'+prop_index+'*/';
			e.index = prop_index++;
			template = template.replace(m[0], m[1]+m[2]+m[3]+string+m[3]);
		}
		else if (e.type === 'comment' && e.deleted === true){
			var regex = ''
			+ '/\\*\\$property'+e.index+'\\*/'
			+ '\\s*';
			template = template.replace(new RegExp(regex), '');
			
			obj.splice(i,1);
		}

		for (x in e.properties){
			x = parseInt(x);
			var p = e.properties[x];
			
			if (typeof p.prop_index === 'undefined' && typeof p.deleted === 'undefined'){
				// Get spacing at the start of the line
				// Look back one property in current dec
				if (e.properties[x-1]){
					var prev = e.properties[x-1];
					var match_prop_index = prev.prop_index;
					var match_value_index = prev.value_index;
					var order = 1;
				}
				// Look forward one property in current dec
				else if (e.properties[x+1]){
					var next = e.properties[x+1];
					var match_prop_index = next.prop_index;
					var match_value_index = next.value_index;
					var order = -1;
				}
				else{
					for (var j = i-1, k = i-0+1; j > 0 || k  < obj.length; j--, k++){
						if (obj[j].type === 'dec' && obj[j].properties.length > 0){
							var item = obj[j].properties[obj[j].properties.length-1];
							break;
						}
						else if (obj[k].type === 'dec' && obj[k].properties.length > 0){
							var item = obj[k].properties[obj[k].properties.length-1];
							break;
						}
					}
					if (typeof item === 'undefined'){
						throw new Error('Nothing to base white space on');
					}
					else{
						var match_prop_index = item.prop_index;
						var match_value_index = item.value_index;
						var empty = true;
					}
				}
				
				var regex = ''
					+ '([^{;]*?)' //1
					+ '\\$property' + match_prop_index
					+ '([^]*?)' // 2
					+ ':'
					+ '([^]*?)' // 3
					+ '\\$value' + match_value_index
					+ '([^]*?)' // 4
					+ '(;|)' //5
					+ '([\\s]*)' //6
					+ '(}|)'; //7
					
				var m = template.match(new RegExp(regex));
				if (empty){
					var string = ''
					+ '(\\$selector' + e.selector_index
					+ '\\s*'
					+ '{)'
					
					var n = m[1]+'$property'+prop_index+m[2]+':'+m[3]+'$value'+value_index+m[4]+';'+m[6];
					template = template.replace(new RegExp(string),'$1'+n);
				}
				else{
					var string = m[1]+'$property' + match_prop_index +m[2]+':'+m[3]+'$value' + match_value_index +m[4]+';';
					var n = m[1]+'$property'+prop_index+m[2]+':'+m[3]+'$value'+value_index+m[4];
					if (order === 1) template = template.replace(string, string + n + m[5]);
					else if (order === -1) template = template.replace(string, n + m[5] + string);
				}

				obj[i].properties[x].prop_index = prop_index++;
				obj[i].properties[x].value_index = value_index++;
			}
			else if (p.deleted === true && typeof p.prop_index === 'undefined'){
				e.properties.splice(x,1);
			}
			else if (p.deleted === true && typeof p.prop_index !== 'undefined'){
				var regex = ''
					+ '([^{;]*?)'
					+ '\\$property' + p.prop_index
					+ '([^]*?)'
					+ ':'
					+ '([^]*?)'
					+ '\\$value' + p.value_index
					+ '([^]*?)'
					+ '(;|})';
					
				template = template.replace(new RegExp(regex),'');
				e.properties.splice(x,1);
			}
		}
		
	}
	this.indexes.selector = selector_index;
	this.indexes.prop     = prop_index;
	this.indexes.value    = value_index;
	this.template         = template;

	return true;
}

ss.fn.render = function(){
	//this.update_template();
	var obj = this.styles;
	var template = this.template;
	
	// Start with replacing known values
	// Keep track of new values too, we will be dealing with those next
	var stylesheet = template;
	for (i in obj){
		var e = obj[i];
		if (e.type == 'dec'){
			if (typeof e.selector_index === 'undefined') continue;
		
			stylesheet = stylesheet.replace('$selector' + e.selector_index, e.selector);
			
			// handle undefined properties
			
			for (x in e.properties){
				var p = e.properties[x];
				if (typeof p.prop_index === 'undefined'){
					
				}
				else{
					// if disabled wrap in comment
					if (p.disabled === true){
						stylesheet = stylesheet
						.replace('$property'+p.prop_index,'/*$property'+p.prop_index)
						.replace(new RegExp('(\\$value'+p.value_index+')(\s*(;|}))','g'),'$1$2*/')
					}
					
					stylesheet = stylesheet
					.replace('$property'+p.prop_index, p.name)
					.replace('$value'+p.value_index, p.value)
				}
			}
		}
		else if (e.type == 'comment'){
			stylesheet = stylesheet
			.replace('$property'+e.index, e.text);
		}
	}

	return stylesheet;
}

ss.fn.update_element = function(){
	this.styleObject.html( this.render() );
}

ss.fn.path = function(){
	var url = this.url;
	base = c.document.location.protocol + '//' + c.document.location.host + c.document.location.pathname;
	
	// Make sure there is not a trailing slash on url
	if (url.substr(-1) == '/')  url = url.substr(0,url.length-1);
	// Base needs one though
	if (base.substr(-1) != '/') base += '/';
	
	// Split up the base url
	var parts = base.match(/((?:http:\/\/)(?:www\.)|(?:http:\/\/)|(?:www\.)|())([\w\d.]+(\.[\w]+)*)(.*)/i);
	base = {
		'scheme':  parts[1]
		,'host':   parts[3]
		,'path':   parts[5]
	};
	
	// If it's already an absolute path
	if (url.match('http://') !== null) return url;
	
	// If the path is from root
	if (url[0] == '/'){
		//var absUrl = location.protocol + '//' + location.host + url;
		return location.protocol + '//' + location.host + url;
	}
	
	var  path      = base.path.split('/')
		,url_path  = url.split('/')
		,end = url_path.pop();
	
	path.pop();
	
	for (i in url_path) {
		segment = url_path[i];
		if (segment == '.'){
			// skip
		}
		else if (segment == '..' && path && path[path.length-1] != '..'){
			path.pop();
		}
		else{
			path.push(segment);
		}
	}
	
	if (end == '.'){
		path.push('');
	}
	else if (end == '..' && path && path[path.length-1] != '..'){
		path[path.length-1] = '';
	}
	else{
		path.push(end);
	}
	
	// Absolute path
	return base.scheme + base.host  + path.join('/');
	}


ss.fn.save = function(){
	var url = localStorage.getItem('cssedit_path');
	if (url === null){
		alert('Please visit the cssedit page so we can set some things up.');
		return false;
	}
	else{
		$.post(url, {file: this.path(), css: this.render()}, function(){
			
		});
	}
}

if (typeof window.cssedit == 'undefined'){
	window.cssedit = c;
}

// When the document is ready call init
$(function(){
	c.init();
});

})(jQuery);