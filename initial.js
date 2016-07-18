var app=angular.module('main', []);


app.controller('main', function ($rootScope,$scope,$timeout){

    //all about easelJS
    var stage = new createjs.Stage("can");
    var mousePointer = new createjs.Shape();
    var drawing = new createjs.Shape();
    var labels=[];
    var label_image=new Image();
    label_image.src="img/tag.png";
	//createjs.Touch.enable(stage);

    stage.addChild(mousePointer);
    stage.addChild(drawing);
    stage.update();


    //Get the IP address of the server where the leap motion is 
    var ipaddress='';

    //stores the data about incoming screenshots
    $scope.imageData=null;

    //the stuff to make the remote connection 1
    var configuration = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]}
    var videoStream; //stream of the video
    var localStream; //local stream of your video
    var dataChannel; //data channel to send images across
    //constraint specifying we need audio and video
    var sdpConstraints = {'mandatory': {
                        'OfferToReceiveAudio':true,
                        'OfferToReceiveVideo':true 
                        }};

    //peer connection to transmit video
    var pc;    


    //assume you are the initiator of the call
    $scope.isInitiator=true;

    //Angular variables mostly UI stuff
    //isInit stores if its in the initial state or not
    $scope.isInit=true;


    /****************************************************************************
    * Signaling server 
     ****************************************************************************/

    // Connect to the signaling server
    var socket = io();
    //chat message not used
    socket.on('chat message',function(message){
        console.log(message)
    })

    //draw a red circle with the mouse and createJS
    socket.on('mouse',function(message){
       
        mousePointer.graphics.clear();
        mousePointer.graphics.beginFill("#ff0000").drawCircle(message.stageX, message.stageY,20);   
        stage.update();       
    })

    socket.on('drawing',function(message){

        drawing.graphics.beginFill("#ff0000").drawCircle(message.stageX, message.stageY,4);   
        stage.update();      
    })

    socket.on('eraser',function(message){

        drawing.graphics.clear();
        mousePointer.graphics.clear();
        for(var i=0;i<labels.length;i++){
            stage.removeChild(labels[i].text);
            stage.removeChild(labels[i].bitmap);

        }

        stage.update();      
    })
	
	

    socket.on('label',function(message){
		
        globalAuxiliar = 1;
        if(message.type=='new'){
            var bitmap=new createjs.Bitmap(label_image);
            bitmap.x=message.x-100;
            bitmap.y=message.y-120;
            bitmap.scaleX=0.8;
            bitmap.scaleY=0.8;

            var text=new createjs.Text(' ','20px Arial','#fff');
            text.maxWidth=200;
            text.textAlign="center"
            text.x=message.x+80-100;
            text.y=message.y+22-120;
            stage.addChild(bitmap)
            stage.addChild(text)
            labels.push({bitmap:bitmap,text:text})

        }
        else if(message.type=='delete'){

        }
        else if(message.type=='update'){
			
			
			if(message.text == '#'){
				
				labels[labels.length-1].text.text=labels[labels.length-1].text.text.substring(0,labels[labels.length-1].text.text.length-1);
				
			}
			else{
				labels[labels.length-1].text.text+=message.text;
			
			}
        }
		
        stage.update();      
    })



    socket.on('address',function (message){
        console.log(message)
        address=message;  
       Leap.loop({host:address,background:true})
        .use('riggedHand',{
            element:document.getElementById('leapcanvas'),
            offset: new THREE.Vector3(0,0,0)
        })
        riggedHandPlugin = Leap.loopController.plugins.riggedHand;
        var y=riggedHandPlugin.camera.position.y;
        var z=riggedHandPlugin.camera.position.z;
        var x=riggedHandPlugin.camera.position.x;
        riggedHandPlugin.camera.position.z=0;
        riggedHandPlugin.camera.position.x=0;
        riggedHandPlugin.camera.position.y=0;
        riggedHandPlugin.camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI/3);
        riggedHandPlugin.camera.position.x=x;
        riggedHandPlugin.camera.position.y=y+25;
        riggedHandPlugin.camera.position.z=z-20;
    });

    socket.on('leapmotion',function(message){
          // render circles based on pointable positions       

    });   



    function drawArc(x,y,z,graphics,color){
      var radius = Math.min(600/Math.abs(y),20);
      var xx=400+(x-radius/2);
      var yy=400+(z-radius/2)
      graphics.beginFill(color).drawCircle(xx, yy,radius);   


    }

    socket.on('screenshot',function(message){
        console.log(message)
        $scope.imageData=message.image;        
    })  

    socket.on('video message', function (message){
      console.log('Client received message:', message);
        if (message.type === 'offer') {
            if(!$scope.isInitiator){
                pc.setRemoteDescription(new RTCSessionDescription(message),function(){

                    pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
                });
                 
            }
        } 
        else if (message.type === 'answer') {
            if($scope.isInitiator){
                pc.setRemoteDescription(new RTCSessionDescription(message),function(){
                  pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);  
                });
            //    
            }
        } 
        else if (message.type === 'candidate') {
            
                pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            
        } 
        else if (message === 'bye' && isStarted) {
            //handleRemoteHangup();
        }
    });


    $scope.userChoice=function(type){
        
        if(type=='expert'){
            //stay at home and wait for the guy to send you video
            $scope.isInitiator=false;
             var constraints = {audio: true};
            getUserMedia(constraints, successCallback, logError);
            
        }
        else{
            //out in the field beaming the video
            var constraints = {video: true};
            getUserMedia(constraints, getMediaSuccessCallback, logError);
        }
        

        //start the user video
        /*GET THE USER MEDIA AND RUN A FUNCTION AFTER GETTING IT*/
        
    }

    function successCallback(stream){
        localStream=stream;
        createPeerConnection();
    }

    //Runs when an image loads on the screen  from the file system and freezes everything 
    $scope.fileNameChanged=function(e){
        console.log(e);
        var reader= new FileReader();
        reader.onload=function (e) {
            console.log(e)  
             $timeout(function() {
                $scope.imageData=e.target.result;
                $scope.frozen=true;
                sendImage($scope.imageData);
                $scope.tool[2]="label_off-01";
                $scope.tool[3]="draw_off-01";
                $scope.tool[4]="clear_off-01";
             });
            // body...
        }
        reader.readAsDataURL(e.files[0])
    }

    //Method to load up the file picker from the system
    $scope.pickFile=function(){     
        $('#filepicker').click()
    }

    //this is to use chrome voice recognition
    //CuRRENTLY REMOBED
    $scope.switchOnVoiceRecognition=function(event){

            var recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onend = function(event) { 
                recognition.start();
            }
            recognition.onresult = function(event) { 
                
                var result=event.results[event.resultIndex][0].transcript.toLowerCase();
                console.log(result)
                
                    if(result.indexOf("screenshot")!=-1){
                            $scope.sendImage();
                        }
                

            }
            recognition.start();
    }

    $scope.switchTool=function(new_tool){
        //hide image and drawing by
        var leapmotionon_prev=$scope.leapmotionon;
        $scope.leapmotionon=false;

        $scope.currentTool=new_tool;

        
        if($scope.tool[new_tool].indexOf('des')!=-1)
            return;

        $scope.tool[0]=toolsOff[0];
        $scope.tool[1]=toolsOff[1];

        if($scope.tool[2].indexOf('des')==-1)
            $scope.tool[2]=toolsOff[2];
        if($scope.tool[3].indexOf('des')==-1)
            $scope.tool[3]=toolsOff[3];
        if($scope.tool[4].indexOf('des')==-1)
            $scope.tool[4]=toolsOff[4];

        if($scope.currentTool==1){

            $scope.leapmotionon=true;
            //
            $scope.tool[new_tool]='hand_on-01';    
        }
        else if($scope.currentTool==4){
            $scope.tool[new_tool]='clear_on-01';    
        }
        else if($scope.currentTool==3){
            $scope.tool[new_tool]='draw_on-01';    
        }
        else if($scope.currentTool==2){
            $scope.tool[new_tool]='label_on-01';    
        }
        else if($scope.currentTool==0){
            $scope.tool[new_tool]='cursor_on-01';    
        }

        if(leapmotionon_prev!=$scope.leapmotionon){
            socket.emit('freeze','leap');
        }
    }



    $scope.currentTool=0; // 0 is mouse 1 is leap motion 2 is drawing labels 3 is painting 4 is eraser
    $scope.tools=["Mouse","Leap Motion","Label","Painting","Eraser"];
    $scope.tool=["cursor_on-01","hand_off-01","label_des-01","draw_des-01","clear_des-01"];
    var toolsOff=["cursor_off-01","hand_off-01","label_off-01","draw_off-01","clear_off-01"];
    $scope.freezesource=['freeze-06','live-06']
    $scope.isMouseDown=false;
    $scope.frozen=false;
    $scope.leapmotionon=false;


    $scope.freeze=function(){
        if($scope.frozen){
            $scope.frozen=false;
            socket.emit('freeze','')
            $scope.tool[2]="label_des-01";
            $scope.tool[3]="draw_des-01";
            $scope.tool[4]="clear_des-01";
        }
        else{
            $scope.frozen=true;

            $scope.sendImage();
            $scope.tool[2]="label_off-01";
            $scope.tool[3]="draw_off-01";
            $scope.tool[4]="clear_off-01";
        }

    }

    $(document).keypress(function (e) {
        // body...] 
        switch($scope.currentTool){
            case 2:
                socket.emit('label',{type:'update',text:String.fromCharCode(e.keyCode)});
                break;
        }
    })

    $scope.mouseUp=function(event){
        $scope.isMouseDown=false;
        console.log(event)

        switch($scope.currentTool){
            case 2:
                socket.emit('label',{type:'new',x:event.offsetX,y:event.offsetY});
                break;
        }
    }


    $scope.mouseDown=function(event){
        $scope.isMouseDown=true;
    }
    $scope.mouseMove=function(event){
        //If current tool is 
        switch($scope.currentTool){
            case 0:
                socket.emit('mouse',{stageX:event.offsetX,stageY:event.offsetY});
                break;
            case 3: 
                if($scope.isMouseDown)
                    socket.emit('drawing',{stageX:event.offsetX,stageY:event.offsetY});
                break;
         }
        
    }

    $scope.mouseClick=function(event){
        switch($scope.currentTool){
            case 4:
                   socket.emit('eraser','')
                   break;
        }
    }

    $scope.sendImage=function(){
        var canvas=document.getElementById('hiddencanvas');
        var photoContext=canvas.getContext('2d');
        photoContext.drawImage(document.querySelector('video'), 0, 0, 840, 630);

        //var bitmap=new createjs.Bitmap(document.querySelector('video'));
        //bitmap.removeAllEventListeners();        
        

        var img = canvas.toDataURL("image/png");
        $timeout(function() {
            $scope.imageData=img;
        });

        sendImage(img);
      
    }

    function sendImage(img){
        var CHUNK_LEN = 64000;
                var    len = img.length,
            n = len / CHUNK_LEN | 0;

        console.log('Sending a total of ' + len + ' byte(s) in ');
        dataChannel.send("len:"+n);

        // split the photo and send in chunks of about 64KB
        for (var i = 0; i < n; i++) {
            var start = i * CHUNK_LEN,
                end = (i+1) * CHUNK_LEN;
            console.log(start + ' - ' + (end-1));
            dataChannel.send(img.slice(start, end));
        }

        // send the reminder, if any
        if (len % CHUNK_LEN) {
            console.log('last ' + len % CHUNK_LEN + ' byte(s)');
            dataChannel.send(img.slice(n * CHUNK_LEN));
        }

    }

    //This runs after the webcam starts up the method binds
    //the video stream to the video object
    //
    //In case you are the field op making a call it runs startCall
    function getMediaSuccessCallback(stream){
        var video = document.querySelector('video');
        var video2= document.querySelector('video.cameratwo')
        video2.src=source
        var source=window.URL.createObjectURL(stream);
        video.src=source

        videoStream=stream;
        if($scope.isInitiator)
            startCall();
    }


    function startCall(){
        createPeerConnection();
        pc.createOffer(setLocalAndSendMessage, logError);
    }

    //This creates a connection between two Peers
    //It adds the Ice Candidate to allow them to join
    //it has a method to run when a stream is added if it is not
    //the initiator
    function createPeerConnection(){
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        if(!$scope.isInitiator){
            pc.addStream(localStream)
            pc.onaddstream = handleRemoteStreamAdded;
            pc.ondatachannel = function (event) {
                console.log('ondatachannel:', event.channel);
                dataChannel = event.channel;
                onDataChannelCreated(dataChannel);
            };

        }
        else{
            pc.addStream(videoStream);
            dataChannel = pc.createDataChannel("photos");
            onDataChannelCreated(dataChannel);
        }
    }

    function setLocalAndSendMessage(sessionDescription) {
        pc.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage sending message' , sessionDescription);
        socket.emit('video message',sessionDescription);
    }

    function handleRemoteStreamAdded(event) {
        console.log('Remote stream added.');
        socket.emit('address','hello there')

        $timeout(function() {
            $scope.isInit=false;
        });
        var video = document.querySelector('video');
        var video2= document.querySelector('video.cameratwo')
        video.src = window.URL.createObjectURL(event.stream);
        video2.src = window.URL.createObjectURL(event.stream);
        videoStream = event.stream;
    }


    function onDataChannelCreated(channel) {
        console.log('onDataChannelCreated:', channel);

        channel.onopen = function () {
            console.log('CHANNEL opened!!!');
        };

       channel.onmessage =  receiveDataChromeFactory();
    }

    //built for receiving a screenshot of the video from Chrome
    function receiveDataChromeFactory() {
        var buf='', count,len=0;

        return function onmessage(event) {
            console.log(event)
            if (event.data.indexOf('len:') === 0) {
                len=parseInt(event.data.substring(4))+1;
                buf='';
                count = 0;
                console.log('Expecting a total of ' + len + ' bytes');
                return;
            }
            else{
                buf+=event.data;
            }

            count += 1;
            console.log('count: ' + count);

            if (count === len) {
                // we're done: all data chunks have been received
                console.log('Done. Rendering photo.');
                console.log(buf)
                renderPhoto(buf);
            }
        }
    }

    function renderPhoto(data) {
        $timeout(function() {
            $scope.imageData=data;
        });

    }

    function handleIceCandidate(event) {
      console.log('handleIceCandidate event: ', event);
      if (event.candidate) {
        socket.emit('video message',{
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate});
      } else {
        console.log('End of candidates.');
      }
    }

    function logError(error){
        console.log("error is "+error)
    }


    $scope.userChoice('expert')

})
