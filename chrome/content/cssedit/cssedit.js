FBL.ns(function() { with (FBL) {
var jQuery, c, hints, match_colors;
var setup = true;
var panelName = 'CSSEdit';
var DomUtils = FBL.CCSV("@mozilla.org/inspector/dom-utils;1", "inIDOMUtils");
var FileIO = {

		localfileCID  : '@mozilla.org/file/local;1',
		localfileIID  : Components.interfaces.nsILocalFile,

		finstreamCID  : '@mozilla.org/network/file-input-stream;1',
		finstreamIID  : Components.interfaces.nsIFileInputStream,

		foutstreamCID : '@mozilla.org/network/file-output-stream;1',
		foutstreamIID : Components.interfaces.nsIFileOutputStream,

		sinstreamCID  : '@mozilla.org/scriptableinputstream;1',
		sinstreamIID  : Components.interfaces.nsIScriptableInputStream,

		suniconvCID   : '@mozilla.org/intl/scriptableunicodeconverter',
		suniconvIID   : Components.interfaces.nsIScriptableUnicodeConverter,

		open   : function(path) {
			try {
				var file = Components.classes[this.localfileCID]
								.createInstance(this.localfileIID);
				file.initWithPath(path);
				return file;
			}
			catch(e) {
				return false;
			}
		},

		read   : function(file, charset) {
			try {
				var data     = new String();
				var fiStream = Components.classes[this.finstreamCID]
									.createInstance(this.finstreamIID);
				var siStream = Components.classes[this.sinstreamCID]
									.createInstance(this.sinstreamIID);
				fiStream.init(file, 1, 0, false);
				siStream.init(fiStream);
				data += siStream.read(-1);
				siStream.close();
				fiStream.close();
				if (charset) {
					data = this.toUnicode(charset, data);
				}
				return data;
			} 
			catch(e) {
				return false;
			}
		},

		write  : function(file, data, mode, charset) {
			try {
				var foStream = Components.classes[this.foutstreamCID]
									.createInstance(this.foutstreamIID);
				if (charset) {
					data = this.fromUnicode(charset, data);
				}
				var flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
				if (mode == 'a') {
					flags = 0x02 | 0x10; // wronly | append
				}
				foStream.init(file, flags, 0664, 0);
				foStream.write(data, data.length);
				// foStream.flush();
				foStream.close();
				return true;
			}
			catch(e) {
				return false;
			}
		},

		create : function(file) {
			try {
				file.create(0x00, 0664);
				return true;
			}
			catch(e) {
				return false;
			}
		},

		unlink : function(file) {
			try {
				file.remove(false);
				return true;
			}
			catch(e) {
				return false;
			}
		},

		path   : function(file) {
			try {
				return 'file:///' + file.path.replace(/\\/g, '\/')
							.replace(/^\s*\/?/, '').replace(/\ /g, '%20');
			}
			catch(e) {
				return false;
			}
		},

		toUnicode   : function(charset, data) {
			try{
				var uniConv = Components.classes[this.suniconvCID]
									.createInstance(this.suniconvIID);
				uniConv.charset = charset;
				data = uniConv.ConvertToUnicode(data);
			} 
			catch(e) {
				// foobar!
			}
			return data;
		},

		fromUnicode : function(charset, data) {
			try {
				var uniConv = Components.classes[this.suniconvCID]
									.createInstance(this.suniconvIID);
				uniConv.charset = charset;
				data = uniConv.ConvertFromUnicode(data);
				// data += uniConv.Finish();
			}
			catch(e) {
				// foobar!
			}
			return data;
		}

	}

Firebug.CSSEditModel = extend(Firebug.Module, {
    initialize: function(prefDomain, prefNames) {
        Firebug.Module.initialize.apply(this, arguments);
    },
	
	showPanel: function(browser, panel){
		if (panel.name === 'CSSEdit' || panel.name === 'CSSEditHTMLPanel'){
			c = panel;
			if(panel.panelNode.children.length === 0){
				panel.render();
				panel.setupDB();
			}
			else{
				panel.refreshView();
			}
			
			if(!panel.panelBrowser.contentWindow.jQuery){
				panel.addScripts();
				panel.liveEvents();
			}
			else{
				jQuery = panel.panelBrowser.contentWindow.jQuery;
			}
			
		}
	},
	
	showSidePanel: function(browser, panel){
		this.showPanel.apply(this, arguments);
		panel.filterView(FirebugContext.getPanel('html').selection);
	}
});

function CSSEditPanel() {}
CSSEditPanel.prototype = extend(Firebug.Panel,
{
    name: "CSSEdit",
    title: "CSSEdit",
	stylesheets: {},
	document: false,
	hints: {'properties': {}, 'keywords': {}},
	document: window.content,
	
    initialize: function() {
		Firebug.Panel.initialize.apply(this, arguments);
		if (typeof this.context.files === 'undefined') this.context.files = [];
		if (typeof this.context.stylesheet === 'undefined') this.context.stylesheet = {};
		if (typeof this.context.active_value === 'undefined') this.context.active_value = false;
	},
		
	destroy: function(){
		Firebug.Panel.destroy.apply(this, arguments);
	},
	
	addScripts: function(){
		// Get jQuery in here
		var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
            .getService(Components.interfaces.mozIJSSubScriptLoader);
		loader.loadSubScript("chrome://cssedit/content/js/jquery-1.6.2.js", this);
		loader.loadSubScript("chrome://cssedit/content/js/jquery.tmpl.js", this);
		loader.loadSubScript("chrome://cssedit/content/js/jquery-ui-1.8.11.custom.min.js", this);
		loader.loadSubScript("chrome://cssedit/content/js/properties.js", this);
		loader.loadSubScript("chrome://cssedit/content/js/colorpicker.js", this);
		jQuery = this.panelBrowser.contentWindow.jQuery;
	},
	
	render: function() {
		if (setup){
			this.addScripts();
		}

		// Build regex to match all known colors
		match_colors = new RegExp('(#[A-z0-9]{3}\\b|#[A-z0-9]{6}\\b|#[A-z0-9]{8}\\b|rgba\\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3},\\d?(\\.\\d+)?\\)|rgb\\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\\)' + '|' + c.hints.keywords.color.join('|') + ')', 'i');
	
		// Find CSS files that we will be working with.
		// CSS files will be limited by same-origin policy so make sure they are
		// on the same domain.
		if(c.context.files.length === 0) c.context.files = c.getFiles();
		
		// Load all files
		for (var i = 0; i < c.context.files.length; i++){
			var url = c.context.files[i];
			if (typeof c.context.stylesheet[url] === 'undefined'){
				c.context.stylesheet[url] = new ss(url);
			}
		}
		
		// Build interface		
		jQuery('<link />',{type: 'text/css',rel: 'stylesheet', href: 'chrome://cssedit/content/css/master.css'}).prependTo(this.panelNode);
		jQuery('<link />',{type: 'text/css',rel: 'stylesheet', href: 'chrome://cssedit/content/css/theme/jquery-ui-1.8.11.custom.css'}).prependTo(this.panelNode);
		jQuery('<link />',{type: 'text/css',rel: 'stylesheet', href: 'chrome://cssedit/content/css/colorpicker.css'}).prependTo(this.panelNode);
		
		c.load('chrome://cssedit/content/templates/css_items.html', function(data){
			data = jQuery(data);
			jQuery.template('dec', data[0]);
			jQuery.template('prop', data[1]);
			
		
		c.load('chrome://cssedit/content/templates/interface.html', function(data){
			jQuery.template('interface',data);
			jQuery.tmpl('interface',{files: c.context.files, panel: c}).appendTo(c.panelNode);
			
			jQuery(c.panelNode)
			.find('.save_as').button({icons: {primary: 'ui-icon-folder-open'}, text: false})
			.next('.save').button({icons: {primary: 'ui-icon-disk'}, text: false})
			.next('.sort').button({icons: { primary: 'ui-icon ui-icon-arrowthick-2-n-s' }, text: false});
			
			jQuery(c.panelNode).find('#color_picker').ColorPicker({
			flat: true
			,onChange: function(hsb,hex,rgb){
				if (c.context.active_value){
					c.context.active_value.trigger('update_color', arguments);
				}
			}
		})
		.hide()
		.bind('mouseleave', function(e){
			jQuery(this).hide();
		});;

		
			c.load('chrome://cssedit/content/templates/css.html', function(data){
				jQuery.template('css', data);

				if (c.name === 'CSSEdit'){
					// Auto display the first CSS file
					c.display(c.context.files[0]);
				}
				else if (c.name === 'CSSEditHTMLPanel'){
					c.filterView(FirebugContext.getPanel('html').selection);
				}
			
				if (setup){
					setup = false;
					c.liveEvents();
				}
			});
		});			
		});

		
	},
		
	
	
	stylesheet: function(stylesheet){
		if (!stylesheet) stylesheet = c.context.files[jQuery(c.panelNode).find('select').val()];
		return c.context.stylesheet[stylesheet];
	},
	
	refreshView: function(){
		c.display(c.stylesheet().url);
	},
	
	liveEvents: function() {
		jQuery('.save').live('click', function(e){
			c.stylesheet().save();
		});
		
		jQuery('.save_as').live('click', function(e){
			c.stylesheet().save_as();
		});
		
		var sort_start;
		jQuery('.sort').live('click', function(e){
			jQuery(c.panelNode).find('.stylesheet').sortable({
				axis: 'y',
				containment: 'parent',
				items: '.dec, .comment',
				distance: 10,
				disabled: jQuery(this).hasClass('ui-state-disabled'),
				items: '.dec, .comment',
				update: function(e, ui){
					// Remove .grabber elements because they will end up out of place
					var node = jQuery(c.panelNode);
					node.find('#stylesheet .grabber').remove();
		
					// Add .grabber elements
					jQuery('<div />',{'class':'grabber'}).insertBefore(node.find('.dec,.comment'));
					jQuery('<div />',{'class':'grabber'}).appendTo(node.find('#stylesheet'));
		
					c.stylesheet().move_dec(sort_start, c.dec_index(ui.item));
				},
				start: function(e, ui){
					sort_start = c.dec_index(ui.item);
				}
			}).toggleClass('ui-sortable-enabled');
			jQuery(this).toggleClass('ui-state-disabled');
		});
		
		// Events for dropdown menu to change stylesheets
		jQuery('#cssedit_file').live('change',function(e){
			var url = c.context.files[ jQuery(e.target).val() ];
			c.display(url);
		});
	
		// Setup events
	
		// Right clicking things
		jQuery('#stylesheet').live('contextmenu mousedown mouseup', function(e){
			if (e.which === 3){
				e.preventDefault();
	
				// In firefox in no contenteditable element is focus it will select everything
				var target = jQuery(e.target);
				if (target.attr('class') === 'selector') target.focus();
				else if (target.attr('class') === 'dec') target.find('.selector').focus();
				else if (target.attr('class') === 'property') target.find('.name').focus();
				else if (target.attr('id') === 'stylesheet') jQuery('.selector:eq(0)').focus();
	
				if (e.type == 'mouseup'){
	
					// Show menu to delete/insert property
					if(target.is('.property,.name,.value')){
						var menu = jQuery('<div />',{'class':'cssedit_menu'})
						.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
						.appendTo('body')
						.mouseleave(function(e){
							jQuery(this).remove();
						});
	
						jQuery('<a />').text('Delete')
						.appendTo(menu)
						.button()
						.bind('click',{property: target.closest('.property')}, function(e){
							jQuery(e.target).parent().parent().remove();
							var tmplItem = jQuery.tmplItem(target);
							var dec = tmplItem.parent.data;

							tmplItem.data.deleted = true;
							c.stylesheet(dec.styleSheet).update_template();
							c.stylesheet(dec.styleSheet).update_element();
							e.data.property.remove();
						});
	
						jQuery('<a />')
						.text('Insert')
						.appendTo(menu)
						.button()
						.bind('click',{target: target}, function(e){
							e.data.target.trigger('add_property');
						});
					}
	
					// Show menu to insert dec/comment
					else if (target.is('.grabber') && c.name === 'CSSEdit'){
						var menu = jQuery('<div />',{'class':'cssedit_menu'})
						.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
						.appendTo('body')
						.mouseleave(function(e){
							jQuery(this).remove();
						});
	
						jQuery('<a />').text('Add comment').button()
						.bind('click',{target: target}, function(e){
							jQuery(e.target).parent().parent().remove();
							jQuery(e.data.target).trigger('add_comment');
						})
						.appendTo(menu);
	
						jQuery('<a />').text('Add declaration').button()
						.bind('click',{target: target}, function(e){
							jQuery(e.target).parent().parent().remove();
							jQuery(e.data.target).trigger('add_dec');
						})
						.appendTo(menu);
					}
	
					// Show menu to remove comments
					else if (target.is('.comment')){
						var menu = jQuery('<div />',{'class':'cssedit_menu'})
						.css({position: 'fixed', left: e.clientX-15, top: e.clientY-15})
						.appendTo('body')
						.mouseleave(function(e){
							jQuery(this).remove();
						});
	
						jQuery('<a />').text('Delete comment').button()
						.bind('click',{target: target}, function(e){
							jQuery(e.target).parent().parent().remove();
							jQuery(e.data.target).trigger('delete_comment');
						})
						.appendTo(menu);
					}
				}
			}
		});
	
		// Prevent new lines
		jQuery('.dec').find('.selector, .value, .property, .name').live('keydown keyup', function(e){
			if(e.which === 13){
				e.preventDefault();
			}
		});
	
		jQuery('.dec .selector').live('keyup', function(e){
			// Pressing enter on a selector for a dec with no properties adds
			// a property if were not accepting a code hint
			if (e.which === 13){
				var next = jQuery(e.target).parent().find('.properties .property:eq(0)');
				if (next.length > 0){
					next.focus();
				}
				else{
					jQuery(e.target).parent().find('.properties').trigger('add_property');
				}
			}
	
			// Else update object
			else{
				var dec = jQuery.tmplItem(this).data;
				dec.selector = jQuery(e.target).text();
				c.stylesheet(dec.styleSheet).update_element();
				
				if (c.name === 'CSSEditHTMLPanel'){
					c.filterView();
				}
			}
		});
	
		// Changing comment
		jQuery('.comment').live('keyup',function(e){
			var comment = jQuery.tmplItem(this).data;
			comment.text = jQuery(e.target).html().replace(new RegExp('<br>', 'gi'), "\n");
		});
	
		// Value/name navigation
		jQuery('.dec .name,.dec .value').live('keyup update',function(e){
			if(e.which === 13){
				e.preventDefault();
				var type = jQuery(e.target).attr('class')
					,next = (type == 'property' ? jQuery(e.target).next().next() : jQuery(e.target).next());
	
				// Add a new property/value set
				if (jQuery(this).is('.name') || (!hints || hints.is(':empty'))){
					if(next.length == 0){
						jQuery(e.target).trigger('add_property');
					}
					// Go to the next property
					else{
						next.focus();
					}
				}
			}
			else{
				var type = jQuery(e.target).attr('class');
					
				var tmplItem = jQuery.tmplItem(this);
				dec = tmplItem.parent.data;
				
				tmplItem.data[type] = jQuery(e.target).text();
				c.stylesheet(dec.styleSheet).update_element();
				
				if (c.name === 'CSSEditHTMLPanel'){
					c.styleOverridden();
				}
			}
		});
	
		// Auto remove empty properties
		jQuery('.dec .property').live('focusout',function(e){
			if(jQuery(e.target).closest('.property').text() === ''){
				jQuery(e.target).parent().remove();

				var tmplItem = jQuery.tmplItem(this);
				var dec = tmplItem.data;

				tmplItem.data.deleted = true;
				c.stylesheet(dec.styleSheet).update_template();
				c.stylesheet(dec.styleSheet).update_element();
			}
		});
	
		// Auto remove empty comments
		jQuery('.comment').live('keyup',function(e){
			if ( jQuery.trim(jQuery(e.target).text()) === '') jQuery(e.target).trigger('delete_comment');
		});
	
		// Enable/disable property
		jQuery('.dec input[type="checkbox"]').live('change',function(e){
			var disabled = !e.target.checked
			
			var tmplItem = jQuery.tmplItem(this);
			var dec = tmplItem.parent.data;
			
			tmplItem.data.disabled = disabled;
			c.stylesheet(dec.styleSheet).update_element();
		});
		// Press insert to insert property at current location
		jQuery('.property').live('keyup',function(e){
			if (e.which === 45) jQuery(e.target).trigger('add_property');
		});
	
		// Add property after e.target
		jQuery('.properties').live('add_property',function(e){
			var target = jQuery(e.target);
			if (target.is('.properties')){
				var prop = 0;
			}
			else if (target.is('.property,.name,.value')){
				var prop = jQuery(e.target).closest('.property').index()+1;
			}
			var dec = jQuery.tmplItem(this);
			dec.data.properties.splice(prop,0,{
				name: ''
				,value: ''
				,disabled: false
				,styleSheet: dec.styleSheet
			});
			dec.update();
			c.stylesheet(dec.data.styleSheet).update_template();
			c.stylesheet(dec.data.styleSheet).update_element();
			jQuery(dec.nodes).find('.name:empty').focus();
		});
	
		// Add comment after e.target
		jQuery('.grabber').live('add_comment',function(e){
			var target = jQuery(e.target)
				,index = c.dec_index(target.prev())+1;

			c.stylesheet().styles.splice(index,0,{
				type: 'comment'
				,text: ''
				,styleSheet: c.stylesheet().url
			});
			c.stylesheet().update_template();
			jQuery.tmplItem(this).update();
			
			jQuery(c.panelNode).find('.comment:empty').focus();
		});
	
		// Add dec after e.target
		jQuery('.grabber').live('add_dec',function(e){
			var target = jQuery(e.target)
				,index = c.dec_index(target.prev())+1;
	
			c.stylesheet().styles.splice(index,0,{
				type: 'dec'
				,selector: ''
				,properties: []
				,styleSheet: c.stylesheet().url
			});
			c.stylesheet().update_template();
	
			//jQuery('<div />',{'class':'grabber'}).insertAfter(target);
			//var dec = jQuery('<div />',{'class':'dec','contenteditable':'false'}).insertAfter(target);
			//
			//jQuery('<div />',{'class':'selector','contenteditable':'true'}).appendTo(dec).focus();
			//
			//var props = jQuery('<div />',{'class':'properties'}).appendTo(dec);
			
			jQuery.tmplItem(e.target).parent.update();
			jQuery('.selector:empty').first().focus();
	
		});
	
		// Delete comment
		jQuery('.comment').live('delete_comment',function(e){
			var comment = jQuery.tmplItem(this);
			comment.data.deleted = true;
			c.stylesheet().update_template();
			jQuery(this).next('.grabber').andSelf().remove();
		});
	
		// Skip over checkboxes when tabbing through things
		jQuery('#stylesheet input:checkbox').live('keyup',function(e){
			if (e.which === 9){
				if (e.shiftKey === false) jQuery(this).next().focus();
				else jQuery(this).parent().prev().find('.value').focus();
			}
		});
	
		// Increment numeric values using up/down arrow keys
		jQuery('.value').live('keydown',function(e){
			var target = jQuery(this);
	
			// Get what is at cursor location
			var offset = c.document.defaultView.getSelection().getRangeAt(0).startOffset
				,regex = new RegExp('(.{0,'+offset+'})(\\s|^)(-{0,1}[\\d]+)([\\w]*)(\\s|$)')
				,unit = target.text().match(regex);
	
			if(unit !== null && unit[3].length > 0 && (!hints || hints.is(':empty')) ){
				var i = parseInt(unit[3]);
				var number;
				if (e.shiftKey === false) number = 1;
				else number = 10;
	
				if (e.which === 38) i += number;
				else if (e.which === 40) i -= number;
				else return;
	
				target.text( target.text().replace(regex, '$1$2'+i+ (unit[4] || 'px') +'$5'));
				var range = c.document.createRange();
	
				range.setStart(this.firstChild,offset);
				range.setEnd(this.firstChild,offset);
	
				var sel = c.document.defaultView.getSelection();
				e.preventDefault();
				sel.removeAllRanges();
				sel.addRange(range);
			}
		});
	
		// ctrl+s saves current stylesheet
		jQuery(c.panelNode).bind('keydown', function(e){
			if (e.which === 83 && e.metaKey === true){
				e.preventDefault();
		
				c.stylesheet().save();
			}
		});
		
		// Property hinting
		jQuery('.dec .property .name').live('keyup show_hints', function(e){
			// Don't do anything if arrow down/up or tab
			if ([40, 9, 38, 16].indexOf(e.which) !== -1) return false;
	
			if(hints) hints.children().remove();
			else{
				hints = jQuery('<ul />',{'id':'hints'}).appendTo('#stylesheet');
			}
	
			if(String.fromCharCode(e.which).match(/[A-z-]/) || e.type === 'show_hints' || (e.which === 32 && e.metaKey === true) || e.which === 17){
				var val = jQuery(e.target).text()
					,matches = [];
	
				for(i in c.hints.properties){
					var result = i.match(new RegExp('^'+val,'i'));
					if ( result !== null && result){
						matches.push(i);
					}
				}
	
				jQuery.each(matches, function(i, e){ jQuery('<li />').text(e).appendTo(hints); });
				hints.children().eq(0).addClass('active');
	
				var pos = jQuery(e.target).offset();
				hints.css({left: pos.left, top: pos.top + jQuery(this).height()});
				hints.offset = 0;
			}
	
			return true;
		})
		// CTRL+Space brings up all code hints in values
		.live('keydown', function(e){
			if (e.which === 32 && e.metaKey === true){
				e.preventDefault();
				jQuery(this).trigger('show_hints');
			}
		});
	
		// Value hints
		jQuery('.dec .property .value').live('keyup show_hints', function(e){
			// Don't do anything if arrow down/up or tab
			if ([40, 9, 38, 13, 16].indexOf(e.which) !== -1) return false;
	
			if(hints) hints.children().remove();
			else{
				hints = jQuery('<ul />',{'id':'hints'}).appendTo('#stylesheet');
			}
	
			if(String.fromCharCode(e.which).match(/[A-z-]/) || e.type === 'show_hints' || (e.which === 32 && e.metaKey === true) || e.which === 17){
				var pos = c.document.defaultView.getSelection().getRangeAt(0).startOffset
					,offset = (pos > 0 ? pos-1 : pos)
					,text = jQuery(e.target).text().match(new RegExp('(.{0,'+offset+'}(?:\\s|^))([^\\s]*)'))
					,property = c.hints.properties[ jQuery(e.target).prev().text() ]
					,matches = []
					,val = text[2];
	
				for (i in property){
					var values = c.hints.keywords[property[i]];
					for (x in values){
						var result = values[x].match(new RegExp('^'+val,'i'));
						if ( result !== null && result){
							matches.push(values[x]);
						}
					}
				}
	
				jQuery.each(matches, function(i, e){ jQuery('<li />').text(e).appendTo(hints); });
				hints.children().eq(0).addClass('active');
	
				var pos = jQuery(e.target).offset();
				hints.css({left: pos.left + (jQuery(this).width()/jQuery(this).text().length)*text[1].length, top: pos.top + jQuery(this).height()});
				hints.offset = 0;
			}
	
			return true;
		})
		// CTRL+Space brings up all code hints in values
		.live('keydown', function(e){
			if (e.which === 32 && e.metaKey === true){
				e.preventDefault();
				jQuery(this).trigger('show_hints');
			}
		});
	
		// Code hint list interactions
		var prevPos = 1;
		jQuery('.name, .value', '.dec .property ').live('keydown', function(e){
	
			// Arrow down
			if (e.which === 40 && hints){
				e.preventDefault();
				hints.children().eq(hints.offset).removeClass('active');
	
				hints.offset++;
				if (hints.offset >= hints.children().length) hints.offset = 0;
	
				jQuery(hints).children().eq(hints.offset).addClass('active');
			}
			// Arrow up
			else if (e.which === 38 && hints){
				e.preventDefault();
				hints.children().eq(hints.offset).removeClass('active');
	
				hints.offset--;
				if (hints.offset < 0) hints.offset = hints.children().length-1;
	
				jQuery(hints).children().eq(hints.offset).addClass('active');
			}
			// Tab or enter
			else if (e.shiftKey === false && (e.which === 9 || e.which === 13) && hints && hints.not(':empty').length){
				if(jQuery(this).is('.name') && hints.not(':empty').length){
					jQuery(this).text(hints.children().eq(hints.offset).text());
				}
				else{
					var value = hints.children().eq(hints.offset).text()
						,pos = (prevPos > 0 ? prevPos-1 : 0)
						,text = jQuery(this).text()
						,val = text.replace(new RegExp('(.{0,'+pos+'})(\\s|^)([^\\s]*)'), '$1$2'+value)
						,property = c.hints.properties[ jQuery(e.target).prev().text() ]
						,matches = [];
	
					jQuery(this).text(val);
	
					// Put cursor after the text we just added
					var range = c.document.createRange();
					var point = val.match(new RegExp('(.{0,'+pos+'})(\\s|^)([^\\s]*)'));
					range.setStart(this.firstChild,point[0].length);
					range.setEnd(this.firstChild,point[0].length);
	
					var sel = c.document.defaultView.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
	
				}
	
				jQuery(this).trigger('update');
			}
			else{
				prevPos = c.document.defaultView.getSelection().getRangeAt(0).startOffset;
			}
		});
	
		// Hide hint list on blur
		jQuery('.dec .property ').find('.name, .value').live('focusout', function(){
			if(hints) hints.children().remove();
		});
		
		// Color picker
		var color_pos;
		jQuery('.value').live('keyup mousemove', function(e){
			if (e.type === 'keyup'){
				var offset = c.document.defaultView.getSelection().getRangeAt(0).startOffset
					,box   = jQuery(this).offset()
					,left  = box.left + (jQuery(this).width() /jQuery(this).text().length) * offset
					,top   = box.top;
			}
			else{
				var offset = parseInt((e.clientX - jQuery(this).offset().left) / (jQuery(this).width() /jQuery(this).text().length))
					,left  = e.clientX
					,top  = e.clientY + jQuery('body').scrollTop();
			}
			
			var match_word = new RegExp('(.{0,'+offset+'})(\\s|^)(.+?)(\\s|$)')
				,colors = jQuery(this).text().match(match_word)
				,color = colors[3].match(match_colors);
			
			
			var color_box = jQuery(c.panelNode).find('#color_wrap');
			if (color){
				color_box.show();
				color_box.css({left: left + 20, top: top - 70});
				jQuery(c.panelNode).find('#color').css('background-color', color[0]);
			}
		})
		.live('keydown mouseenter mouseleave', function(e){
			// Make sure color picker is there
			var cp = jQuery(c.panelNode).find('#color_picker');
			clearTimeout(cp[0].timer);
			if(cp.is(':hidden')) return true;
			// On keyup if not ctrl/shift or mouseenter
			if((e.type === 'keydown' && !e.shiftKey && !e.metaKey) || (e.type === 'mouseenter' && c.context.active_value[0] === this)){
				cp.hide();
			}
			// On mouseleave if not on color picker in 1 second
			else if(e.type === 'mouseleave'){
				cp.bind('mouseenter', function(e){
					clearTimeout(cp[0].timer);
				});
				
				cp[0].timer = setTimeout(function(){
					cp.hide().unbind('mouseenter');
				},1000)
			}
			
			return true;
		})
		.live('mouseleave', function(e){
			jQuery(c.panelNode).find('#color_wrap').hide();
		})
		.live('mouseup', function(e){
			// If not ctrl+click
			c.context.active_value = jQuery(this);
			color_pos = c.document.defaultView.getSelection().getRangeAt(0).startOffset;
			if(!e.metaKey || e.which !== 1) return true;
			var offset = parseInt((e.clientX - jQuery(this).offset().left) / (jQuery(this).width() /jQuery(this).text().length))
				,left  = e.clientX
				,top  = e.clientY + jQuery('body').scrollTop()
				,match_word = new RegExp('(.{0,'+offset+'})(\\s|^)(.+?)(\\s|$)')
				,colors     = jQuery(this).text().match(match_word)
				,color      = colors[3].match(match_colors);
			
			if(color){
				color_pos = offset;
				jQuery(c.panelNode).find('#color_picker').ColorPickerSetColor(expandColor(color[0])).show().css({
					position: 'absolute'
					,left: e.clientX + 10
					,top: e.clientY + jQuery('body').scrollTop() + 10
				});
			}
		
			return true;
		})
		.live('update_color', function(e, hsb, hex, rgb){
			var match_word = new RegExp('(.{0,'+color_pos+'})(\\s|^)(.+?)(\\s|$)')
				,colors     = jQuery(this).text().match(match_word)
				,color      = colors[3].match(match_colors);
				
			if (color_pos){
				jQuery(this).text(
					jQuery(this).text().replace(
						new RegExp('(.{0,'+color_pos+'})(\\s|^)(.+?)(\\s|$)')
						,'$1$2'+updateColor(color[0], hsb, hex, rgb)+'$4'
					)
				).trigger('update');
			}
		});
		
		jQuery('.file').live('click', function(){
			var tmplItem = jQuery.tmplItem(this);
			Firebug.chrome.switchToPanel(FirebugContext, 'CSSEdit');
			c.display(tmplItem.data.styleSheet);
			
			var panel = FirebugContext.getPanel('CSSEdit');
			panel.findDec(tmplItem.data);
		});
    },
	
	findDec: function(dec){
		var styles = c.stylesheet().styles;
		//console.log(styles);
		for (var i in styles){
			if (styles[i] === dec){
				var item = jQuery('.dec, .comment')[i];
				item.scrollIntoView();
				jQuery(item).css({backgroundColor: '#FFF793'}).animate({backgroundColor: '#FFF'}, 2000);
				break;
			}
		}
	},
	
	dec_index: function(item){
		var dec = jQuery(item).closest('.dec, .comment');
		return dec.index()-dec.prevAll('.grabber').length;
	},
	
	getFiles: function(){
		var files = [];
		jQuery('link[href][type="text/css"]', window.content.document).each(function(i,e){
			var href = jQuery(this).attr('href');
			files.push( href );
		});

		return files;
	},
	
	load: function(url, callback){
		var req = new XMLHttpRequest();
		req.open('GET',url);
		req.onreadystatechange = function(){
			if (this.readyState == 4){
				callback(this.responseText);
			}
		}
		req.send(null);
	},
		
	display: function(url){
		if (typeof c.context.stylesheet[url] === 'undefined'){
			c.context.stylesheet[url] = new ss(url);
		}
		var select = jQuery('#cssedit_file');
		var select_index = select.find('option:contains("'+url+'")').index();
		select.val(select_index);
		
	
		// Generate css display if there were no errors
		jQuery('#stylesheet', c.panelNode).html( jQuery.tmpl('css', {decs: c.context.stylesheet[url].styles}) ).sortable('refresh');
		jQuery(c.panelNode).find('.wrap.filtered').removeClass('filtered');
	
		var sort_start;
		// Value sorting
		jQuery('.properties', c.displayNode).sortable({
			axis: 'y'
			,handle: '.handle'
			,update: function(e, ui){
				var dec = c.dec_index(this);
				c.stylesheet().move_property(dec, sort_start, ui.item.index());
				c.stylesheet().update_element();
			}
			,start: function(e, ui){
				sort_start = ui.item.index();
			}
		});
	},
	
	expandRelative: function(url, base){
		if(typeof base === 'undefined'){
			base = window.content.document.baseURI;
		}
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
			return window.content.document.baseURI + url;
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
	},
	
	getDB : function() {
		if (!this.db){
			Components.utils.import("resource://gre/modules/Services.jsm");
			Components.utils.import("resource://gre/modules/FileUtils.jsm");
			let file = FileUtils.getFile("ProfD", ["cssedit.sqlite"]);
			this.db = Services.storage.openDatabase(file); // Will also create the file if it does not exist
		}
		return this.db
	},
	
	closeDB: function(){
		if (this.db){
			this.db.close();
		}
	},
	
	setupDB: function(){
		var db = this.getDB();
		var statement = db.createStatement('CREATE TABLE IF NOT EXISTS `files` (`file` TEXT, `localFile` TEXT, PRIMARY KEY (`file`))');
		statement.execute();
	}

});

function CSSEditHTMLPanel(){};
CSSEditHTMLPanel.prototype = extend(CSSEditPanel.prototype, {
	name: 'CSSEditHTMLPanel',
	title: 'CSSEdit',
	parentPanel: 'html',
	
	inheritedStyleNames: {
		"border-collapse": 1,
		"border-spacing": 1,
		"border-style": 1,
		"caption-side": 1,
		"color": 1,
		"cursor": 1,
		"direction": 1,
		"empty-cells": 1,
		"font": 1,
		"font-family": 1,
		"font-size-adjust": 1,
		"font-size": 1,
		"font-style": 1,
		"font-variant": 1,
		"font-weight": 1,
		"letter-spacing": 1,
		"line-height": 1,
		"list-style": 1,
		"list-style-image": 1,
		"list-style-position": 1,
		"list-style-type": 1,
		"opacity": 1,
		"quotes": 1,
		"text-align": 1,
		"text-decoration": 1,
		"text-indent": 1,
		"text-shadow": 1,
		"text-transform": 1,
		"white-space": 1,
		"word-spacing": 1,
		"word-wrap": 1
	},
	
	initialize: function() {
		Firebug.Panel.initialize.apply(this, arguments);
		Firebug.registerUIListener(this);

		if (typeof this.context.files === 'undefined') this.context.files = [];
		if (typeof this.context.stylesheet === 'undefined') this.context.stylesheet = {};
		if (typeof this.context.active_value === 'undefined') this.context.active_value = false;
	},
		
	onObjectSelected: function(node, context){
		this.filterView(node);
	},

	filterView: function(element){
		if (!element){
			element = FirebugContext.getPanel('html').selection;
		}
		
		var panel = jQuery(c.panelNode);
		panel.find('.wrap').addClass('filtered');
		
		var styles = this.getElementRules(element)
		var inherited = this.getInheritedRules(element);
		
		var matchedStyles = [];
		var matchedStyleSheets = [];
		var trackedStyles = {};
		for (var i = 0; i < styles.length; i++){
			var sheet = styles[i][0],
			    style = styles[i][1];
				
			for (var x = 0; x < sheet.styles.length; x++){
				if (typeof trackedStyles[ sheet.url + x ] === 'undefined' && sheet.styles[x].selector === style.selectorText){
					trackedStyles[ sheet.url + x ] = true;
					matchedStyles.splice(0,0,sheet.styles[x]);
				}
			}
		}
		
		var matchedInheritedStyles = [];
		var matchedStyleSheets = [];
		for (var i = 0; i < inherited.length; i++){
			var sheet = inherited[i][0],
			    style = inherited[i][1];
				
			for (var x = 0; x < sheet.styles.length; x++){
				if (typeof trackedStyles[ sheet.url + x ] === 'undefined' && sheet.styles[x].selector === style.selectorText){
					trackedStyles[ sheet.url + x ] = true;
					// Does it have at least one property that is inherited?
					for (var j = 0; j < sheet.styles[x].properties.length; j++){
						if (this.inheritedStyleNames[sheet.styles[x].properties[j].name] === 1){
							matchedInheritedStyles.push(sheet.styles[x]);
							break;
						}
					}
				}
			}
		}
		var stylesheet = panel.find('.stylesheet');
		stylesheet.html('');
		jQuery.tmpl('css', {decs: matchedStyles}).appendTo(stylesheet);
		var inheritedHTML = jQuery.tmpl('css', {decs: matchedInheritedStyles}).appendTo(stylesheet);
		
		if (inheritedHTML.children().length > 1){
			jQuery('<div />',{'class': 'notice'}).text('Inherited Styles').insertBefore(inheritedHTML);

			// Don't show inherited properties
			inheritedHTML.find('.property:not(.'+Object.keys(this.inheritedStyleNames).join(', .')+')').remove();
			
			for (var name in this.inheritedStyleNames){
				panel.find('.'+name+':gt(0)').addClass('overridden');
			}
		}
		
		this.styleOverridden();
	},
	
	styleOverridden: function(){
		var panel = jQuery(c.panelNode);

		// Strike out overridden properties
		var processed = {};
		panel.find('.property').each(function(i, e){
			var name = jQuery(e).find('.name').text();
			if (processed[name] === true) return true;
			else processed[name] = true;
			
			// Check for !important
			var important = panel.find('.property:has(.name:contains("'+name+'") + .value:contains("!important"))');
			if (important.length === 0){
				// Just go based on order
				panel.find('.property:has(.name:contains("'+name+'")):eq(0)').removeClass('overridden');
				panel.find('.property:has(.name:contains("'+name+'")):gt(0)').addClass('overridden');
			}
			else{
				// Strike out all properties, then unstrike the first !important
				panel.find('.property:has(.name:contains("'+name+'"))').addClass('overridden');
				important.first().removeClass('overridden');
			}
			return true;
		});
	},
	
	getInheritedRules: function(element){
		var parent = element.parentNode;
		var rules = [];
		if (parent && parent.nodeType == 1) {
			jQuery.merge(rules, this.getInheritedRules(parent));
			jQuery.merge(rules, this.getElementRules(parent));
		}
		return rules;
	},
	
	getElementRules: function(element){
		try {
			inspectedRules = domUtils ? domUtils.getCSSStyleRules(element) : null;
		} catch (exc) {}
		
		var matchedStyles = [];
		if (inspectedRules) {
			for (var i = 0; i < inspectedRules.Count(); ++i) {
				var style = inspectedRules.GetElementAt(i);
				
				// Do we control the stylesheet that it belongs to?
				for (var x in c.context.stylesheet){
					if(c.context.stylesheet[x].styleObject[0] === style.parentStyleSheet.ownerNode){
						matchedStyles.push([c.context.stylesheet[x], style]);
						break;
					}
				}
			}
			
			return matchedStyles;
		}
		else return false;
	},

});


Firebug.registerPanel(CSSEditHTMLPanel);
Firebug.registerPanel(CSSEditPanel);
Firebug.registerModule(Firebug.CSSEditModel);

var ss = function(url){

	// url of stylesheet
	this.url = url;
	var css = '';
	jQuery.ajax({
		async: false
		,url: this.path()
		,cache: false
		,success: function(data){
			css = data;
		}
	});
	this.css = css;

	// Where we will be updating the css
	this.styleObject = jQuery('<style />',{type: 'text/css'}).appendTo(window.content.document.head);

	this.indexes = {}; // Indexes for template
	this.indexes.selector = 0;
	this.indexes.prop     = 0;
	this.indexes.value    = 0;

	this.template  = ''; // Template for rendering
	this.styles = []; // Parsed styles from this.css

	// Setup everything
	this.parse();
	this.update_element();

	// Remove link to original stylesheet
	jQuery('link[href="'+url+'"]',window.content.document.head).remove();

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
		,skip         = false
		,disabled     = false
		,selector     = ''
		,properties   = []
		,property     = ''
		,value        = ''
		,comment      = ''
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
				place_holder += current.replace(jQuery.trim(selector), '$selector'+selector_index);
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
					name: jQuery.trim(property)
					,value: jQuery.trim(value)
					,prop_index: prop_index++
					,value_index: value_index++
					,disabled: in_comment
				});
			}
			obj.push({
				type: 'dec'
				,selector: jQuery.trim(selector)
				,selector_index: selector_index++
				,properties: properties
				,styleSheet: this.url
			});
			place_holder += current;
			in_dec = in_property = in_value = false;
			comment = current = selector = property = value = '';
			properties = [];
			continue;
		}
		// Look for the start of comments inside decs
		else if (in_dec === true && c === '/' && css[(i*1)+1] === '*'){
			in_comment = true;
			current += css[(i*1)+1];
			if (in_value){
				value += c + css[(i*1)+1];
			}
			i++;
			continue;
		}
		// Look for the end of comments inside decs
		else if (in_dec === true && c === '*' && css[(i*1)+1] === '/'){
			in_comment = false;
			if(comment === ''){
				// It was just a property commented out. Go back and remove
				// opening comment tag
				current = current.substring(0,current.length-1);
				place_holder = place_holder.replace(/\/\*(.*?)$/,'$1');
			}
			else{
				// It was an actual comment, not just a property commented out.
				current += css[(i*1)+1];
			}

			if(!in_value){
				comment = property = value = '';
			}
			else{
				value += c + css[(i*1)+1];
				comment = '';
			}
			i++;
			continue;
		}
		// Look for the end of comments
		else if (in_comment === true && in_dec === false && c === '*' && css[(i*1)+1] === '/'){
			current += css[(i*1)+1];
			place_holder += current.replace(comment, '$property'+prop_index);
			obj.push({
				type: 'comment'
				,text: comment
				,index: prop_index++
				,styleSheet: this.url
			});
			in_comment = in_dec = in_property = in_value = false;
			comment = current = selector = property = value = '';
			properties = [];
			i++;
			continue;
		}

		if (in_comment){
			comment += c;
		}

		if (in_dec === false && in_comment === false){
			selector += c;
		}
		else if (in_dec === true){
			if (in_property === true){
				if (c === ':'){
					// Verify that the property name is valid
					property = jQuery.trim(property);
					var matches = property.match(/^[A-z-]+$/);
					if (matches === null){
						skip = true;
						place_holder += current;
					}
					else{
						place_holder += current.replace(property, '$property'+prop_index);
					}
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
					if(!skip){
						place_holder += current.replace(jQuery.trim(value), '$value'+value_index);
						properties.push({
							name: jQuery.trim(property)
							,prop_index: prop_index++
							,value_index: value_index++
							,value: jQuery.trim(value)
							,disabled: in_comment
						});
						comment = current = property = value = '';
						in_value = false;
						in_property = true;
					}
					else{
						skip = false;
						place_holder += current;
						current = property = value = '';
						in_value = false;
						in_property = true;
					}
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
	var css   = this.render()
		,urls = css.match(/url\(['"]?[^"')]+['"]?\)/gi)
		,url  = /url\((['"]?)([^"')]+)(['"]?)\)/
		,base = c.expandRelative(this.url).match(/.*\//)[0];

	// Expand urls to absolute path
	for (i in urls){
		var parts = urls[i].match(url)
			,file = c.expandRelative(parts[2], base);

		css = css.replace(parts[0], 'url('+parts[1]+file+parts[3]+')');
	}

	this.styleObject.html( css );
}

ss.fn.path = function(){
	return c.expandRelative(this.url);
}

ss.fn.file = function(){
	return this.url.match(/\/([^/]+)$/)[1];
}


ss.fn.save = function(){
	// Query DB for info on file
	var db = c.getDB();
	var query = db.createStatement("SELECT `localFile` FROM `files` WHERE `file` = :file LIMIT 1");
	query.params.file = this.path();

	// Do we have a record of this file?
	if (!query.executeStep()){
		// No, open file picker
		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		
		filePicker.init(window, 'Save CSS', filePicker.modeSave);
		filePicker.defaultExtension = '.css';
		filePicker.defaultString = this.file();
		filePicker.appendFilter('CSS', '*.css');
		filePicker.appendFilter('Everything', filePicker.filterAll);
		
		var rv = filePicker.show();
		if (rv === filePicker.returnOK || rv === filePicker.returnReplace) {
			// They picked a file, write to disk
			FileIO.write(filePicker.file, this.render());
			
			// Keep a record of which file they picked so they don't have to
			// pick it again.
			var query = db.createStatement("INSERT INTO `files` (`file`, `localFile`) VALUES (:file, :localFile)");
			query.params.file = this.path();
			query.params.localFile = filePicker.file.persistentDescriptor;
			query.execute();
		}
	}
	else{
		// Yes, write to disk
		FileIO.write(FileIO.open(query.row.localFile), this.render());
	}
}

ss.fn.save_as = function(){
	// Query DB for info on file
	var db = c.getDB();

	var filePicker = Components.classes["@mozilla.org/filepicker;1"]
		.createInstance(Components.interfaces.nsIFilePicker);
	
	filePicker.init(window, 'Save CSS As', filePicker.modeSave);
	filePicker.defaultExtension = '.css';
	filePicker.defaultString = this.file();
	filePicker.appendFilter('CSS', '*.css');
	filePicker.appendFilter('Everything', filePicker.filterAll);
	
	var rv = filePicker.show();
	if (rv === filePicker.returnOK || rv === filePicker.returnReplace) {
		// They picked a file, write to disk
		FileIO.write(filePicker.file, this.render());
		
		var query = db.createStatement("SELECT `localFile` FROM `files` WHERE `file` = :file LIMIT 1");
		query.params.file = this.path();
		
		if (query.executeStep()){
			var query = db.createStatement("UPDATE `files` SET `localFile` = :localFile WHERE `file` = :file");
		}
		else{
			var query = db.createStatement("INSERT INTO `files` (`file`, `localFile`) VALUES (:file, :localFile)");
		}
		query.params.file = this.path();
		query.params.localFile = filePicker.file.persistentDescriptor;
		query.execute();
	}
}

ss.fn.move_dec = function(from, to){
	var template  = this.template
		,item     = this.styles[from];

	if (item.type === 'dec'){
		var search = template.match(
			new RegExp(''
				+ '('
					+ '\\$selector'+item.selector_index
					+ '\\s*'
					+ '{'
					+ '[^}]+'
					+ '}'
					+ '\\s*'
				+ ')'
			)
		);
		
	}
	else if (item.type === 'comment'){
		var search = template.match(
			new RegExp(''
				+ '('
					+ '\\/\\*'
					+ '[^*]+'
					+ '\\*\\/'
					+ '\\s*'
				+ ')'
			)
		);


	}
	
	// If we couldn't find the item exit now
	if (!search) return false;
	
	template = template.replace(search[0], '');

	if (this.styles[to].type === 'dec'){
		var match_to = new RegExp(''
			+ '('
				+ '\\$selector'+ this.styles[to].selector_index
				+ '\\s*'
				+ '{'
				+ '[^}]+'
				+ '}'
				+ '\\s*'
			+ ')'
		);
	}
	else if (this.styles[to].type === 'comment'){
		var match_to = new RegExp(''
			+ '('
				+ '\\/\\*'
				+ '\\$property'+this.styles[to].index
				+ '\\*\\/'
				+ '\\s*'
			+ ')'
		);
	}
	
	// If moving down insert after to
	if (from < to){
		template = template.replace(match_to, '$1' + search[0]);
	}
	// Else insert before to
	else{
		template = template.replace(match_to, search[0] + '$1');
	}
	
	this.styles.splice(
		to
		,0
		,this.styles.splice(from,1)[0]
	);
	
	this.template = template;
	return true;
}

ss.fn.move_property = function(dec, from, to){
	// If moving up we want to insert one before our target

	var template  = this.template
		,item     = this.styles[dec].properties;
	
	// Get the text from for the property
	var property = template.match(
		new RegExp(''
			+ '('
				+ '\\s*\\$property'+item[from].prop_index
				+ '\\s*:\\s*'
				+ '\\$value'+item[from].value_index
				+ '\\s*;?'
			+')'
			+ '('
				+ '\\s*'
				+ '\\/\\*'
				+ '[^*]+'
				+ '\\*\\/'
			+ ')?'
		)
	);
	
	// If we couldn't find the property exit now
	if (!property) return false;
	
	template = template.replace(property[0], '');
	
	// Find where to is
	var match_to = new RegExp(''
		+ '('
			+ '\\s*\\$property'+item[to].prop_index
			+ '\\s*:\\s*'
			+ '\\$value'+item[to].value_index
			+ '\\s*;?'
		+')'
		+ '('
			+ '\\s*'
			+ '\\/\\*'
			+ '[^*]+'
			+ '\\*\\/'
		+ ')?'
	);
	
	// If moving down insert after to
	if (from < to){
		template = template.replace(match_to, '$1$2' + property[0]);
	}
	// Else insert before to
	else{
		template = template.replace(match_to, property[0] + '$1$2');
	}
	
	// Update object
	this.styles[dec].properties.splice(
		to
		,0
		,this.styles[dec].properties.splice(from,1)[0]
	);
	
	this.template = template;
	return true;
}
var expandColor = function(color){
	if (color[0] === '#' && color.length == 4){
		return color.replace(/#([\dABCDEF])([\dABCDEF])([\dABCDEF])/i, '#$1$1$2$2$3$3');
	}
	else if (color[0] === '#' && color.length == 7){
		return color;
	}
	else if (color.substr(0, 3) === 'rgb'){
		var match = color.match(/rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(,\d?.?\d?)?\)/);
		return {
			r: match[1]
			,g: match[2]
			,b: match[3]
		}
	}
	else return false;
}

var updateColor = function(old, hsb, hex, rgb){
	if ((old[0] === '#' && old.length == 4) || (old[0] === '#' && old.length == 7)){
		// Can the new color be compressed back down to 3?
		var compressed = hex.match(/([\dABCDEF])\1([\dABCDEF])\2([\dABCDEF])\3/i);
		if (compressed){
			return '#' + compressed[1]+compressed[2]+compressed[3];
		}
		else return '#' + hex;
	}
	else if (old[0] === '#' && old.length == 7){
		return '#' + hex;
	}
	else if (old.substr(0, 3) === 'rgb'){
		var match = old.match(/(rgba?)\((\d{1,3}),(\d{1,3}),(\d{1,3})((,\d?(\.\d+)?)?)\)/);
		return match[1] + '('+rgb.r+','+rgb.g+','+rgb.b+match[5]+')';
	}
	else return false;
}

}});