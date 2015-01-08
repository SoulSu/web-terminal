
;(function(){
	
	$.fn.WebTerminal = function(options){
		var self 	= this
		  , $this 	= $(self)
		  , $canvas = $this.find("canvas").get(0)
		  , canvasOptions 	= {
				height: $(document.body).height(),
				width: $(document.body).width(),
				background: "#333",
				textColor: "#00FF00",
				webSocket: {
					protocol: "wss",
					url: "127.0.0.1",
					port: "9090"
				}
			};

		canvasOptions = $.extend(canvasOptions, options);


		var init = function(){
			var canvasDom
			  = ''
			  + '<canvas>'
			  + '</canvas>'
			  ;
			$canvas = $(canvasDom);
			$this.append($canvas);
		};

		!function(){
			if(!$canvas){
				init();
			}

			$canvas.height(canvasOptions.height);
			$canvas.width(canvasOptions.width);

			console.log($canvas);

		}();




		return $this;
	};

})();
console.log( $("#terminalId").WebTerminal() );
