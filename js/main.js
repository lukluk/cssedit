(function($){

var c = {};
var url = 'http://localhost/cssedit/';
c.indexes = {};
c.container = $('<div />', {id: 'cssedit'}); // Container we are rendering to
c.files; // All known CSS files
c.css = {};

c.init = function(){
	// Find CSS files that we will be working with.
	// CSS files will be limited by same-origin policy so make sure they are
	// on the same domain.
	c.files = c.getFiles();
	
	// Setup list of CSS files to edit

	// Add container to body
	$('body').append(c.container);
	c.container.width($(window).width()-20)
	
	// Get templates
	$.get(url + 'templates/interface.html', function(data){
		$.template('interface',data);
		$.tmpl('interface',{files: c.files}).appendTo(c.container);

		$.get(url + 'templates/css.html', function(data){
			$.template('css', data);
			
			// Auto display the first CSS file
			c.display(c.files[0]);
		});
	});
	
	// Setup events

	// Right clicking things
	$('#cssedit_stylesheet').live('contextmenu mousedown mouseup', function(e){
		if (e.which === 3){
			e.preventDefault();
			
			// In firefox in no contenteditable element is focus it will select everything
			var target = $(e.target);
			if (target.attr('class') === 'selector') target.focus();
			else if (target.attr('class') === 'dec') target.find('.selector').focus();
			else if (target.attr('class') === 'property') target.find('.name').focus();
			else if (target.attr('id') === 'cssedit_stylesheet') $('#cssedit_stylesheet .selector:eq(0)').focus();
			
			if (e.type == 'mouseup'){
				
				// Show menu to delete/insert property
				if(target.is('.property,.name,.value')){
					var menu = $('<div />',{'class':'cssedit_menu'})
					.css({position: 'absolute', left: e.clientX-15, top: e.clientY-15})
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
						c.css[dec].properties[prop].deleted = true;
						c.update_template();
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
				else if (target.is('#cssedit_stylesheet .grabber')){
					var menu = $('<div />',{'class':'cssedit_menu'})
					.css({position: 'absolute', left: e.clientX-15, top: e.clientY-15})
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
					.css({position: 'absolute', left: e.clientX-15, top: e.clientY-15})
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
	$('.selector, .value, .property','#cssedit_stylesheet .dec').live('keypress', function(e){
		return e.which != 13;
	});
	
	$('#cssedit_stylesheet .dec .selector').live('keyup', function(e){
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
			c.css[index].selector = $(e.target).text();
			c.styleObj.html(c.render());
		}
	});
	
	// Changing comment
	$('#cssedit_stylesheet .comment').live('keyup',function(e){
		var index = $(e.target).index('.dec,.comment');
		c.css[index].text = $(e.target).html().replace(new RegExp('<br>', 'gi'), "\n");
	});
	
	// Value/name navigation
	$('#cssedit_stylesheet .dec .name,#cssedit_stylesheet .dec .value').live('keyup',function(e){
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
		// Pressed up arrow
		else if (e.which === 38){
			var target = $(e.target);
			var prev_prop = target.closest('.property').prev().find('.'+target.attr('class'));
			if (prev_prop.length > 0) prev_prop.focus();
			else{
				target.closest('.dec').find('.selector').focus();
			}
		}
		// Pressed down arrow
		else if (e.which === 40){
			var target = $(e.target);
			var next_prop = target.closest('.property').next().find('.'+target.attr('class'));
			if (next_prop.length > 0) next_prop.focus();
			else{
				var next = target.closest('.dec').nextAll('.dec:eq(0),.comment:eq(0)').first();
				if(next.attr('class') === 'dec'){
					next.find('.selector').focus();
				}
				else next.focus();
			}
		}
		else{
			var dec = $(e.target).closest('.dec').index('.dec,.comment')
				,prop = $(e.target).parent().index()
				,type = $(e.target).attr('class');
			c.css[dec].properties[prop][type] = $(e.target).text();
			c.styleObj.html(c.render());
		}
	});
	
	// Arrow navigation from selector
	$('#cssedit_stylesheet .dec .selector, .comment').live('keydown',function(e){
		var target = $(e.target);
		// Pressed up arrow
		if (e.which === 38 && target.closest('.dec,.comment').index('.dec,.comment') > 0){
			var prev = target
			.closest('.dec,.comment')
			.prev().prev();
			if (prev.is('.dec')){
				prev.find('.property:last .value').focus();
			}
			else if (prev.is('.comment')){
				prev.focus();
			}
		}
		// Pressed down arrow
		else if (e.which === 40){
			if (target.attr('class') === 'selector'){
				var prop = target.parent().find('.property:first .name');
				if (prop.length > 0) prop.focus();
				else{
					target.next().next().find('.selector').focus();
				}
			}
			else /* === 'comment' */ {
				target.next().next().find('.selector').focus();
			}
		}
	});
	
	// Auto remove empty properties
	$('#cssedit_stylesheet .dec .property').live('focusout',function(e){
		if($(e.target).closest('.property').text() === ''){
			$(e.target).parent().remove();
		}
	});
	
	// Auto remove empty comments
	$('#cssedit_stylesheet .comment').live('keyup',function(e){
		if ( $.trim($(e.target).text()) === '') $(e.target).trigger('delete_comment');
	});
	
	// Enable/disable property
	$('#cssedit_stylesheet .dec input[type="checkbox"]').live('change',function(e){
		var dec = $(e.target).closest('.dec').index('.dec,.comment')
			,prop = $(e.target).parent().index()
			,disabled = !e.target.checked
		c.css[dec].properties[prop].disabled = disabled;
		c.styleObj.html(c.render());
	});
	// Press insert to insert property at current location
	$('#cssedit_stylesheet .property').live('keyup',function(e){
		if (e.which === 45) $(e.target).trigger('add_property');
	});
	
	// Add property after e.target
	$('#cssedit_stylesheet .properties').live('add_property',function(e){
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
		c.css[dec].properties.splice(prop,0,{
			name: ''
			,value: ''
			,disabled: false
		});
		c.styleObj.html(c.render());
		c.update_template();
		
		$('<input />',{'type': 'checkbox','checked':'checked'}).appendTo(wrap);
		$('<div />',{'class': 'name','contenteditable':'true'}).appendTo(wrap).focus();
		$('<div />',{'class': 'value','contenteditable':'true'}).appendTo(wrap);
	});
	
	// Add comment after e.target
	$('#cssedit_stylesheet .grabber').live('add_comment',function(e){
		var target = $(e.target)
			,index = target.prev().index('.dec,.comment')+1;
		c.css.splice(index,0,{
			type: 'comment'
			,text: ''
		});
		c.update_template();
		
		$('<div />',{'class':'grabber'}).insertAfter(target);
		$('<div />',{'class':'comment','contenteditable':'true'}).insertAfter(target).focus();
	});
	
	// Add dec after e.target
	$('#cssedit_stylesheet .grabber').live('add_dec',function(e){
		var target = $(e.target)
			,index = target.prev().index('.dec,.comment')+1;
		
		c.css.splice(index,0,{
			type: 'dec'
			,selector: ''
			,properties: []
		});
		c.update_template();
		
		$('<div />',{'class':'grabber'}).insertAfter(target);
		var dec = $('<div />',{'class':'dec','contenteditable':'false'}).insertAfter(target);
		
		$('<div />',{'class':'selector','contenteditable':'true'}).appendTo(dec).focus();
		
		var props = $('<div />',{'class':'properties'}).appendTo(dec);
		
	});
	
	// Delete comment
	$('#cssedit_stylesheet .comment').live('delete_comment',function(e){
		var target = $(e.target);
		var index = target.index('.dec,.comment');
		c.css[index].deleted = true;
		c.update_template();
		target.next('.grabber').andSelf().remove();
	});
}

c.getFiles = function(){
	var files = []
		,our_css = ['css/master.css']
	$('link[href][type="text/css"]').each(function(i,e){
		var href = $(this).attr('href');
		if ($.inArray(href, our_css) === -1) files.push( href );
	});
	
	return files;
}

c.display = function(url){
	// Get css and parse it
	$.get(url, function(data){
		c.css = c.parse(data);
		$('link[href="'+url+'"]').remove();
		c.styleObj = $('<style />',{type: 'text/css'}).html(c.render()).appendTo('head');
		
		// Generate css display if there were no errors
		$('#cssedit_stylesheet').html( $.tmpl('css', {decs: c.css}) );
	});
}

c.parse = function(css){
	var obj = []
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
	this.render_template  = place_holder += current;
	
	return obj;
}

c.update_template = function(){
	var template = this.render_template;
	var obj = this.css;
	
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
				+ '(\\s+)';
			}
			else if (prev.type === 'comment'){
				regex = ''
				+ '(\\$property' + prev.index +')'
				+ '([^]*?\\*/)'
				+ '(\\s+)';
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
				+ '(\\s+)';
			}
			else if (prev.type === 'comment'){
				regex = ''
				+ '(\\$property' + prev.index +')'
				+ '([^]*?\\*/)'
				+ '(\\s+)';
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
	this.render_template  = template;

	return true;
}

c.render = function(){
	//this.update_template();
	var obj = this.css;
	var template = this.render_template;
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


c.save = function(css){
	
}

if (typeof window.cssedit == 'undefined'){
	window.cssedit = c;
}

// When the document is ready call init
$(function(){
	c.init();
});

})(jQuery);