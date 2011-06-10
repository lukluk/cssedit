CSSEdit
===========

CSSEdit's goal is to make it so that you can edit CSS in any modern browser, view the changes live, and save them to your server.

Almost all the code is written in JavaScript therefore the code needed to save changes is very simple and would be easy to implement in other languages. Currently only PHP is supported. When I have time, more languages will be added.

Backing up your CSS is highly recommended.

Support
----------

### Browsers

- Firefox
- Safari
- Chrome
- Opera
- Internet Explorer 9 (Partial)

### Server Side Languages

- PHP
- More to come...

Keyboard Shortcuts
----------------------

- __CTRL+S__: Save
- __Insert__: Insert property after current property
- __Up Arrow__: Increment numeric value
- __Down Arrow__: Decrement numeric value
- __Shift+Up Arrow__: Increment numeric value by 10
- __Shift+Down Arrow__: Decrement numeric value by 10
- __CTRL+W (_in pop-up_)__: Move CSSEdit back to window

Setup
--------

1. Place CSSEdit on your server.
2. Go to /cssedit/drivers/cssedit.php
3. Set url to the correct path in js/main.js
4. Create a new bookmark with the location set to the code below
5. Change the url variable to match your setup
6. Repeat steps 4 and 5 for every browser you want to use CSSEdit with

```javascript
javascript:(function(){var url='http://localhost/cssedit/',body=document.body,iframe=document.createElement('iframe');iframe.setAttribute('src',localStorage.getItem('cssedit_path')+'?empty');iframe.onload=function(){var b=iframe.contentDocument.head;var c=['js/jquery-1.5.2.js','js/jquery-ui-1.8.11.custom.min.js','js/jquery.tmpl.js','js/main.js'],styles=['css/master.css','css/theme/jquery-ui-1.8.11.custom.css'];for(i in styles){var d=iframe.contentDocument.createElement('link');d.setAttribute('type','text/css');d.setAttribute('rel','stylesheet');d.setAttribute('href',url+styles[i]);b.appendChild(d)};var x=0;var e=function(){if(typeof c[x]==='undefined'){iframe.contentWindow.cssedit.init();return false};var a=iframe.contentDocument.createElement('script');a.setAttribute('type','text/javascript');a.setAttribute('src',url+c[x]);x++;a.onload=e;b.appendChild(a)};e()};body.appendChild(iframe);})()
```