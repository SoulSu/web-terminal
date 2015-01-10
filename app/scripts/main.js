
'use strict';
;(function(){
	$.fn.WebTerminal = function(options){

		var TERMINAL_EOL    = '囍'
		  , TERMINAL_EOL_REGEXP = new RegExp(TERMINAL_EOL, 'g')
		  , TERMINAL_NO_CMD = ': command not found'
		  , TERMINAL_HISTORY_SIZE = 200
		  , TERMINAL_HISTORY = []
		  , TERMINAL_MAX_CHAR = 5000
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
		  , keyMap = {
				 65: 'a'
				,66: 'b'
				,67: 'c'
				,68: 'd'
				,69: 'e'
				,70: 'f'
				,71: 'g'
				,72: 'h'
				,73: 'i'
				,74: 'j'
				,75: 'k'
				,76: 'l'
				,77: 'm'
				,78: 'n'
				,79: 'o'
				,80: 'p'
				,81: 'q'
				,82: 'r'
				,83: 's'
				,84: 't'
				,85: 'u'
				,86: 'v'
				,87: 'w'
				,88: 'x'
				,89: 'y'
				,90: 'z' 
			  }
		  ;

		var debug = false;

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
				for(var i=1; i<rows-1; i++){
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
			var popLen = outPutArr.length - lines;
			if(popLen<0) popLen = 0;
			return outPutArr.slice(popLen);
		};

		var doShow = function(){
			if(!$canvas){ init(); }
			context = $canvas.get(0).getContext('2d');
			_util = new canvasUtil();
			_util.reDraw(inputText);
		};

		var getCmd = function(textStr){
			var tmp = textStr.split(TERMINAL_EOL);
			tmp = tmp[tmp.length - 2].split(canvasOptions.prefixText);
			return tmp[1];
		};

		var parseInput = function(event){
			var keyCode = event.keyCode;
			// console.log(event);
			console.log(inputText);

			if(keyCode === 8){
				if(inputText[inputText.length-1] == canvasOptions.prefixText){
					return false;
				}
				inputText.pop();
			}else if(keyCode === 13){

				if(inputText[inputText.length-1] === canvasOptions.prefixText){
					inputText.push(TERMINAL_EOL);
					inputText.push(canvasOptions.prefixText);
				}else{
					inputText.push(TERMINAL_EOL);

					var cmd = getCmd(inputText.join(''))
					  , ajaxOver = false
					  , ajaxFlag = false
					  , ajaxReturnData = ''
					  ;

					$.ajax({
						url: './cmd/'+cmd,
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
					  			if(ajaxFlag){
					  				inputText = inputText.concat(ajaxReturnData);
					  			}else{
									inputText.push(cmd + TERMINAL_NO_CMD);
					  			}
								inputText.push(TERMINAL_EOL);
								inputText.push(canvasOptions.prefixText);
								_util.reDraw(inputText);
					  		}
					  	}
					  	, 100);
				}
			}else if((keyCode === 34 || keyCode === 33) && event.shiftKey){
				// run PageUp and shiftKey
				if(keyCode === 33){

				}else{

				}
			}else if($.inArray(keyCode, ingnoreKeyCode) !== -1){
				return false;
			}else if(event.ctrlKey && keyCode === 76){
				inputText = [canvasOptions.prefixText];
			}else{
				// inputText.push(String.fromCharCode(keyCode));
				inputText.push(event.key);
				// console.log(event.key.toString(), keyMap["65"]);
				// inputText.push(keyMap[event.key.toString()]);
			}
			return true;
		};

		var inputText  = [canvasOptions.prefixText]
		  , ingnoreKeyCode = 
			[
				 9   // Tab
				,13  // Enter
				,16  // Shift
				,17  // Control
				,18  // Alt
				,19  // Pause
				,20  // CapsLock
				,27  // Esc
				,33  // PageUp
				,34  // PageDown
				,35  // End
				,36  // Home
				,37  // Left
				,38  // Up
				,39  // Right
				,40  // Down
				,45  // Insert
				,46  // Del
				,91  // OS
				,93  // Menu
				,112 // F1
				,113 // F2
				,114 // F3
				,115 // F4
				,116 // F5
				,117 // F6
				,118 // F7
				,119 // F8
				,120 // F9
				,121 // F10
				,122 // F11
				,123 // F12
				,144 // NumLock
				,145 // ScrollLock
			  ]
		  ;
		var tmp = [];
		!function(){
			doShow();
			_util.drawCurosr();
			$(window).on('keydown',  function(event) {
				if(event.keyCode === 9 || (event.keyCode === 76 && event.ctrlKey))
					event.preventDefault();
				console.log(event.keyCode + ", // " + event.key);
				tmp.push(event.keyCode + ":'" + event.key +"'");
				console.log(tmp.join(','));
				// console.log(event);
				if( parseInput(event) )
					_util.reDraw(inputText);
			});
		}();

		$(window).resize(function(event) {
			/* Act on the event */
			// doShow();
		});

		return $this;
	};

})();

$('#terminalId').WebTerminal({
	height: $('#terminalId').height(),
	width: $('#terminalId').width(),
	reqUrl: './cmd/',
	reqData: {
		_: +new Date()
	}
});
