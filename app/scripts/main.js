
'use strict';

window.console = window.console || {log: function(){return false;}, info: function(){return false;}};

;(function(){
	$.fn.WebTerminal = function(options){

		var TERMINAL_EOL    = '囍'
		  , TERMINAL_EOL_REGEXP = new RegExp(TERMINAL_EOL, 'g')
		  , TERMINAL_NO_CMD = ': command not found'
		  , TERMINAL_HISTORY_SIZE = 200
		  , TERMINAL_HISTORY = []
		  , TERMINAL_MAX_CHAR = 5000
		  , TERMINAL_VERIFY = 'Please Input Password: '
		  , TERMINAL_VERIFY_EXIT = 'exit'
		  ;


		var self 	= this
		  , $this 	= $(self)
		  , $canvas = $this.find('canvas').get(0)
		  , context = null
		  , canvasOptions = $.extend({
				height: document.body.clientHeight || $(window).height(),
				width: document.body.clientWidth || $(window).width(),
				background: '#000',
				textColor: '#00FF00',
				webSocket: {
					protocol: 'wss',
					url: '127.0.0.1',
					port: '9090'
				},
				textSize: 14,
				line_height: 0,
				// prefixText: '[root@localhost ~]# '
				prefixText: '# //: '
			}, options)
		  , lastCurosrPosition = {x: 20, y: 20, yh: 17, yStep: 14}
		  , lines 	= Math.floor(canvasOptions.height / ( canvasOptions.textSize + canvasOptions.line_height))
		  , rows	= Math.floor(canvasOptions.width / canvasOptions.textSize)
		  , _util 	= null
		  , nowPrefixText = canvasOptions.prefixText
		  , inputText  = []
		  , ingnoreKeyCode = 
			[
				9   /*Tab*/ ,13  /*Enter*/ ,16  /*Shift*/ ,17  /*Control*/ ,18  /*Alt*/ ,19  /*Pause*/ ,20  /*CapsLock*/ ,27  /*Esc*/ ,33  /*PageUp*/ ,34  /*PageDown*/ ,35  /*End*/ ,36  /*Home*/ ,37  /*Left*/ ,38  /*Up*/ ,39  /*Right*/ ,40  /*Down*/ ,45  /*Insert*/ ,46  /*Del*/ ,91  /*OS*/ ,93  /*Menu*/ ,112 /*F1*/ ,113 /*F2*/ ,114 /*F3*/ ,115 /*F4*/ ,116 /*F5*/ ,117 /*F6*/ ,118 /*F7*/ ,119 /*F8*/ ,120 /*F9*/ ,121 /*F10*/ ,122 /*F11*/ ,123 /*F12*/ ,144 /*NumLock*/ ,145 /*ScrollLock*/ 
			]
		  , pageStep = 0
		  , isVerify = false
		  , verifyPass = false
		  , varifyInputKey = []
		  ;
		  
		var debug = !!false;

		var init = function(){
			var canvasDom
			  = ''
			  + '<canvas>'
			  + '</canvas>'
			  ;
			$canvas = $(canvasDom);
			$this.append($canvas);
			$canvas.attr('height',canvasOptions.height);
			$canvas.attr('width',canvasOptions.width);
		};

		var canvasUtil = function(cnt, height, width, background, textColor){
			this.context = cnt || context;
			this.height  = height || canvasOptions.height;
			this.width 	 = width || canvasOptions.width;
			this.background = background || canvasOptions.background;
			this.textColor  = textColor || canvasOptions.textColor;
			this.context.font = canvasOptions.textSize + 'px Verdana';

			this.realWidth = this.width - 40;
			this.realHeight = this.height - 40;
			lines = Math.floor( this.realHeight/lastCurosrPosition.yh );
		};
		
		canvasUtil.prototype.drawText = function(textArr){
			this.context.fillStyle = this.textColor;
			// console.log(textArr.length,'row', lines, rows, Math.floor( this.realHeight/lastCurosrPosition.yh ) );
			for(var i=1; i<=textArr.length; i++){
				this.context.fillText(textArr[i-1], 20, lastCurosrPosition.yh * i + lastCurosrPosition.yStep);
				lastCurosrPosition.x = this.context.measureText(textArr[i-1]).width + 20;
				lastCurosrPosition.y = lastCurosrPosition.yh * i + lastCurosrPosition.yStep;
			}
		};
		
		canvasUtil.prototype.drawBackground = function(){
			this.context.fillStyle = this.background;
			this.context.fillRect(0, 0, this.width, this.height);
			if(debug){
				this.context.strokeStyle = '#fff';
				this.context.rect(20, 20, this.realWidth, this.realHeight);
				this.context.stroke();
				var lh = ( lastCurosrPosition.yh )
				  , tw = canvasOptions.textSize;
				this.context.strokeStyle = '#fff';
				for(var i=1; i<lines+1; i++){
					this.context.beginPath();
					this.context.moveTo(20, lh*i + 20);
					this.context.lineTo(this.width-20, lh*i + 20);
					this.context.stroke();
				}
				for(var i=1; i<rows-2; i++){
					this.context.beginPath();
					this.context.moveTo(tw*i + 20, 20);
					this.context.lineTo(tw*i + 20, this.height - 20);
					this.context.stroke();
				}
			}
		};
		
		canvasUtil.prototype.clean = function(){
			this.context.clearRect(0, 0, this.width, this.height);
		};
		
		canvasUtil.prototype.drawCurosr = function(step){
			var step = step || 0
			  , _this = this
			  , pos = {
				  	x: canvasOptions.textSize,
				  	y: 4
				  }
			  ;
			switch(step){
				case 0:
					step++;
					this.context.fillStyle = this.textColor;
					this.context.fillRect(lastCurosrPosition.x, lastCurosrPosition.y, pos.x, pos.y);
				break;
				case 1:
					this.context.fillStyle = this.background;
					this.context.fillRect(lastCurosrPosition.x, lastCurosrPosition.y, pos.x, pos.y);
					step = 0;
				break;
			}
			setTimeout(function(){_this.drawCurosr(step)}, 500);
		};
		
		canvasUtil.prototype.reDraw = function(text){
			this.clean();
			this.drawBackground();
			this.drawText(this.setInputText(text));
		};

		canvasUtil.prototype.setInputText = function(text){
			var outPutArr = []
			  , putText   = ''
			  , nowLen = outPutArr.length;
			for(var i=0; i<text.length; i++){
				var t = text[i];
				if(t == TERMINAL_EOL){
					nowLen ++;
					t = '';
					putText = '';
				}
				if(this.context.measureText(putText).width >= this.realWidth){
					nowLen ++;
					putText = '';
				}
				putText += t;
				outPutArr[nowLen] = putText;
			}
			// console.log(pageStep, "lines: " + lines, "outPutArr.length: " + outPutArr.length);

			if(pageStep > 0){
				var totalStep = Math.floor(outPutArr.length / lines);
				if(pageStep >= totalStep) pageStep--;
				var end   = (totalStep - pageStep) <= 0 ? outPutArr.length : lines * (totalStep - pageStep)
				  , start = (end - lines < 0) ? 0 : end - lines
				  ;
				return outPutArr.slice(start, end);
			}else{
				var popLen = outPutArr.length - lines;
				if(popLen<0) popLen = 0;
				return outPutArr.slice(popLen);
			}
		};

		var doShow = function(){
			if(!$canvas){ init(); }
			context = $canvas.get(0).getContext('2d');
			_util = new canvasUtil();
			_util.reDraw(inputText);
		};

		var getCmd = function(textStr){
			var tmp = textStr.split(TERMINAL_EOL);
			tmp = tmp[tmp.length - 2].split(nowPrefixText);
			return tmp[1];
		};

		var parseInput = function(event){
			var keyCode = event.which;

			if(keyCode === 8){
				if(inputText[inputText.length-1] === nowPrefixText){
					return false;
				}
				if(isVerify && !verifyPass)	varifyInputKey.pop();
				inputText.pop();
			}else if(keyCode === 13){

				if(inputText[inputText.length-1] === nowPrefixText){
					inputText.push(TERMINAL_EOL);
					inputText.push(nowPrefixText);
				}else{
					inputText.push(TERMINAL_EOL);
					var cmd = getCmd(inputText.join(''))
					  , ajaxOver = false
					  , ajaxFlag = false
					  , ajaxReturnData = ''
					  ;
					if(isVerify && !verifyPass){
						if(varifyInputKey.join('') === canvasOptions.verify.key){
							if(canvasOptions.verify.success){
								canvasOptions.verify.success();
								verifyPass = true;
								nowPrefixText = canvasOptions.prefixText;
							}
						}else{
							if(canvasOptions.verify.error) canvasOptions.verify.error();
						}
						inputText.push(TERMINAL_EOL);
						inputText.push(nowPrefixText);
						_util.reDraw(inputText);
						varifyInputKey.length = 0;
					}else{

						$.ajax({
							url: canvasOptions.reqUrl + cmd,
							type: 'GET',
							dataType: 'text',
							data: $.extend(canvasOptions.reqData, {})
						})
						.done(function(data) {
							// console.log("success", data);
							ajaxReturnData = data.replace(/\n/g,TERMINAL_EOL).split('');
							ajaxFlag = true;
						})
						.fail(function() {
							console.log("error");
						})
						.always(function() {
							ajaxOver = true;
						});

						var intervalID 
						  = setInterval(function(){
						  		if(ajaxOver){
						  			clearInterval(intervalID);
						  			if(ajaxFlag && ajaxReturnData.length > 0){
						  				inputText = inputText.concat(ajaxReturnData);
						  			}else if(cmd === TERMINAL_VERIFY_EXIT && isVerify){
						  				if(canvasOptions.verify.exitcallback) canvasOptions.verify.exitcallback();
						  				verifyPass = false;
						  				nowPrefixText += TERMINAL_VERIFY;
						  			}else{
										inputText.push(cmd + TERMINAL_NO_CMD);
						  			}
									inputText.push(TERMINAL_EOL);
									inputText.push(nowPrefixText);
									_util.reDraw(inputText);
						  		}
						  	}
						  	, 100);
					}
				}
				pageStep = 0;
			}else if((keyCode === 34 || keyCode === 33) && event.shiftKey){
				// run PageUp and shiftKey
				if(keyCode === 33){
					pageStep ++;
				}else{
					if(pageStep !== 0) pageStep --;
					if(pageStep < 0) pageStep = 0;
				}
			}else if($.inArray(keyCode, ingnoreKeyCode) !== -1){
				return false;
			}else if(event.ctrlKey && keyCode === 76){
				inputText = [nowPrefixText];
			}else{
				if(isVerify && !verifyPass){
					varifyInputKey.push($.realKey(event));
					inputText.push("*");
				}else{
					inputText.push($.realKey(event));
				}
			}
			return true;
		};

		!function(){
			nowPrefixText = canvasOptions.prefixText;
			if(canvasOptions.verify && canvasOptions.verify.is){
				isVerify = true;
				nowPrefixText += TERMINAL_VERIFY;
			}
			inputText.push(nowPrefixText);
			doShow();
			_util.drawCurosr();
			$(window).on('keydown',  function(event) {
				if(event.which === 9 || event.which === 46 || (event.which === 76 && event.ctrlKey))
					event.preventDefault();
				if( parseInput(event) )
					_util.reDraw(inputText);

				return false;
			});
		}();


		return {
			// type [text|image|]
			exportData: function(type){
				var type = type || 'text'
				  , win  = window.open('', '_blank');
				  ;
				switch(type){
					case 'text':
						win.document
						   .write(inputText.join('')
						   .replace(TERMINAL_EOL_REGEXP,'<br/>'));
						win.document.close();
						break;
					case 'image':
						var image = $canvas.get(0)
									.toDataURL("image/png")
									.replace("image/png", "image/octet-stream")
						  , $a = $('a#web-terminal-download').size() > 0 ? $('a#web-terminal-download') : $('<a>')
						  ;
						  $a.attr({
						  	id: 'web-terminal-download',
						  	href: image,
						  	target: '_blank',
						  	download: (+ new Date()) + '.png'
						  });
						$this.append($a);
						$a.get(0).click();
						break;
					default:
						return false;
						break;
				}
			}
		};
	};
})();

