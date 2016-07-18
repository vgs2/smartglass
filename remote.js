var app=angular.module('main', []);

app.controller('main', function ($scope,$timeout){

    //all about easelJS
    var stage = new createjs.Stage("can");
    var mousePointer = new createjs.Shape();
    var drawing = new createjs.Shape();
    var labels=[];

    var label_image=new Image();
    label_image.src="img/tag.png";

    stage.addChild(mousePointer);
    stage.addChild(drawing);

    stage.update();


    //Get the IP address of the server where the leap motion is 
    var ipaddress='';

    //stores the data about incoming screenshots
    $scope.imageData=null;

    //the stuff to make the remote connection
    var configuration = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]}
    var videoStream;
    var dataChannel;
    var sdpConstraints = {'mandatory': {
                        'OfferToReceiveAudio':true,
                        'OfferToReceiveVideo':true 
                        }};




    //assume you are the initiator of the call
    $scope.isInitiator=true;

    //Angular variables mostly UI stuff
    //isInit stores if its in the initial state or not
    $scope.isInit=true;


    /****************************************************************************
    * Signaling server 
     ****************************************************************************/

    // Connect to the signaling server
    //
    var socket = io();

    //when we receive a message then log it on the console
    socket.on('chat message',function(message){
        console.log(message)
    })

    //when the mouse moves draw a circle using createjs
    socket.on('mouse',function(message){
        mousePointer.graphics.clear();
        mousePointer.graphics.beginFill("#ff0000").drawCircle(message.stageX, message.stageY,20);   
        stage.update();       
    })

    socket.on('address',function (message){
        console.log(message)
        address=message;
       Leap.loop({host:address,background:true})
        .use('riggedHand',{
            element:document.getElementById('leapcanvas'),
            offset: new THREE.Vector3(1,0,0)
          // positionScale: 2
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

    socket.on('drawing',function(message){

        drawing.graphics.beginFill("#ff0000").drawCircle(message.stageX, message.stageY,4);   
        stage.update();      
    })

    socket.on('freeze',function(m) {
        console.log(m)
        if(m=='leap'){
            $timeout(function() {
                $scope.leapmotionon=!$scope.leapmotionon;
            });
        }
        else{
            $timeout(function() {
                $scope.freeze(false);
            });
        }
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
        
        if(message.type=='new'){
            var bitmap=new createjs.Bitmap(label_image);
            bitmap.x=message.x-60;
            bitmap.y=message.y-120;
            bitmap.scaleX=0.8;
            bitmap.scaleY=0.8;

            var text=new createjs.Text(' ','20px Arial','#fff');
            text.maxWidth=200;
            text.textAlign="center"
            text.x=message.x+80-60;
            text.y=message.y+22-120;
            stage.addChild(bitmap)
            stage.addChild(text)
            labels.push({bitmap:bitmap,text:text})

        }
        else if(message.type=='delete'){

        }
        else if(message.type=='update'){
            labels[labels.length-1].text.text+=message.text;

        }
        stage.update();      
    })

    $scope.draw=function(frame){
        if (frame.pointables.length > 0) {
            var interactionBox = frame.interactionBox;
            var centers=[];
            for (var i = 0; i < frame.pointables.length; i++) { 
                var pointable=frame.pointables[i];
                
                pointable.bones.forEach( function(bone){
                    var center=bone.center()
                  centers.push({center:center,type:bone.type,handId:pointable.handId,pointableType:pointable.type});
                })
            }
            var message=centers;
            hands.forEach(function(hand){
                fingerTypeMap.forEach(function(finger){
                    boneTypeMap.forEach(function(bone){
                        fingerCircles[hand][finger][bone].graphics.clear();
                    });
                });
            }) 
          if (message.length > 0) {
            var hand1id=-1;
            for (var i = 0; i < message.length; i++) {
                var pointable = message[i];
                var hand=0;
                if(hand1id==pointable.handId)
                    hand=0;
                else if(hand1id==-1)
                    hand1id=pointable.handId;
                else
                    hand=1;


                var center=pointable.center
                var hand=hands[hand];
                var finger=fingerTypeMap[pointable.pointableType];
                var bone=boneTypeMap[pointable.type];
                var obj=fingerCircles[hand][finger][bone].graphics;
                drawArc(center[0],center[1],center[2],obj,"#ff0000")  
                stage.update();       

            }
          } 
            //socket.emit('leapmotion',centers)
        }
    }

    



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
                    pc.createAnswer(setLocalAndSendMessage);
                });
                 
            }
        } 
        else if (message.type === 'answer') {
            //if($scope.isInitiator){
                pc.setRemoteDescription(new RTCSessionDescription(message),function(){
                    pc.createAnswer(setLocalAndSendMessage);
                });
             //   pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
            //}
        } 
        else if (message.type === 'candidate') {
            if($scope.isInitiator){
                pc.addIceCandidate(new  RTCIceCandidate(message.candidate));
            }
        } 
        else if (message === 'bye' && isStarted) {
            //handleRemoteHangup();
        }
    });

    var pc;    

    $scope.userChoice=function(type){
        $scope.isInit=false;
        if(type=='expert'){
            //stay at home and wait for the guy to send you video
            $scope.isInitiator=false;
            createPeerConnection();
        }
        else{
            //out in the field beaming the video
            var video_constraints={mandatory:{maxWidth:640,maxHeight:480}};
            var constraints = {video: video_constraints,audio:true};
            getUserMedia(constraints, getMediaSuccessCallback, logError);
        }
        

        //start the user video
        /*GET THE USER MEDIA AND RUN A FUNCTION AFTER GETTING IT*/
        
    }


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

    $scope.toggleVideoClass=function(){
        if($scope.showVideo=='Show Video')
            return 'lowopacity';
        else
            return '';
    }


    $scope.toggleVideo=function(){
        if($scope.showVideo=='Show Video')
            $scope.showVideo='Hide Video';
        else
            $scope.showVideo='Show Video';
    }

    $scope.showVideo='Show Video';

    $scope.currentTool=0;
    $scope.tools=["Mouse","Painting","Label","Leap Motion","Eraser"];
    $scope.isMouseDown=false;
    $scope.frozen=false;
    $scope.leapmotionon=false;


    $scope.freeze=function(freezing){
        if($scope.frozen){
            $scope.frozen=false;
        }
        else{
            $scope.frozen=true;
            //$scope.sendImage();
        }

        $scope.frozen=freezing;

    }
    $scope.mouseUp=function(event){
        $scope.isMouseDown=false;
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
            case 1: 
                if($scope.isMouseDown)
                    socket.emit('drawing',{stageX:event.offsetX,stageY:event.offsetY});
                break;
        }
        
    }


    $scope.sendImage=function(){
        var canvas=document.getElementById('hiddencanvas');
        var photoContext=canvas.getContext('2d');
        photoContext.drawImage(document.querySelector('video'), 0, 0, 320, 240);

        //var bitmap=new createjs.Bitmap(document.querySelector('video'));
        //bitmap.removeAllEventListeners();        
        var CHUNK_LEN = 64000;

        var img = canvas.toDataURL("image/png");
        $timeout(function() {
            $scope.imageData=img;
        });
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
        video.src=window.URL.createObjectURL(stream);
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
            pc.onaddstream = handleRemoteStreamAdded;
            pc.ondatachannel = function (event) {
                console.log('ondatachannel:', event.channel);
                dataChannel = event.channel;
                onDataChannelCreated(dataChannel);
            };
        }
        else{
            pc.addStream(videoStream);
            pc.onaddstream = handleRemoteStreamAdded;
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
        var video = document.querySelector('audio');
        video.src = window.URL.createObjectURL(event.stream);
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
            console.log('asdasds    ')
            $scope.imageData=data; 
            $scope.freeze(true);
        });

    }

    function handleIceCandidate(event) {
      console.log('handleIceCandidate event: ', event);
      if (event.candidate) {
        socket.emit('video message',{
          type: 'candidate',
          candidate: event.candidate});
      } else {
        console.log('End of candidates.');
      }
    }

    function logError(error){
        console.log("error is "+error)
    }


    $scope.startAction=function(){
        $scope.userChoice('remote')

        if(document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen();    
        else
            document.documentElement.webkitRequestFullscreen();    
    }
    

})
  
    
    
    







