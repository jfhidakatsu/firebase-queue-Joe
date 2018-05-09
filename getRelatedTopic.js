const Queue = require('firebase-queue');
const firebase = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const request = require('request');

var PROJECTS = ["morphus-app", "morphus-development"];

//SET TARGET PROJECT TO CHANGE DATABASES.
var TARGET = 1;

//Initialize Firebase
var serviceAccount = require("./" + PROJECTS[TARGET] + "-firebase-adminsdk.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://" + PROJECTS[TARGET] + ".firebaseio.com/"
});

const headers = {
    'origin': 'https://research.google.com',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'pragma': 'no-cache',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36',
    'content-type': 'text/plain;charset=UTF-8',
    'accept': '/',
    'cache-control': 'no-cache',
    'dnt': '1',
};


const queueRef = firebase.database().ref('firebase-queue');
const serverRef = firebase.database().ref('node-server');
const responseRef = firebase.database().ref('firebase-response');


queueRef.child('specs').update({
    getRelatedTopic: {
        start_state: 'getRelatedTopic',
        in_progress_state: 'getRelatedTopic_in_progress'
    },
});

var getRelatedTopicOptions = {
    'specId': 'getRelatedTopic'
};


var getRelevantTopicQueue = new Queue(queueRef, getRelatedTopicOptions, function (data, progress, resolve, reject) {
    console.log("in getRelatedTopic");

    let inputString = data.text;

    let plainString = inputString.toLowerCase().replace(/\W/g, ''); //make alphanumeric
    serverRef.child('topics').child(plainString).once('value')
    .then(snapshot => {
        if(snapshot.exists()) {
            let response = {
                input: inputString,
                output: {
                    topicPlain: plainString,
                    topicName: snapshot.val().topicName
                }
            };
            return responseRef.child("getRelatedTopic").child(data.requestId).set(response)
            .then(() => resolve());
        }

        else {
            fs.readFile('./topics.json', 'utf8', function (err, fileContents) {
                if (err) return console.log(err);
                let topics = JSON.parse(fileContents);
        
                
        
                let aiInput = ["curated23", inputString, null, topics,[],null,null,"b",3];
        
                getRelatedTopic(aiInput)
                .then(output => {
                    let response = {
                        input: inputString,
                        output: output
                    };
                    return responseRef.child("getRelatedTopic").child(data.requestId).set(response)
                })
                .then(() => resolve());
        
            });
        }
    })

    


});

function getRelatedTopic(aiInput) {
    
    return new Promise((resolve, reject) => {
        const url = 'https://research.google.com/semantris/rank';

        request({
            headers: headers,
            url: url,
            method: 'POST',
            body: aiInput,
            json: true,
            gzip: true
        }, function(err, res, body) {
            if(err) console.log(err);
        
            else {
                let mostRelevant = body[0][0];
                let text = mostRelevant[0];
                let topicPlain = text.toLowerCase();
                let stringScore = mostRelevant[2];
                console.log('Most relevant match is ' + text);
                console.log('Score is ' + stringScore);

                //If there is no third entry, it seems the match is very strong.
                if(!stringScore) {
                    getTopicName(topicPlain)
                    .then(snapshot => {
                        resolve({topicPlain: topicPlain, topicName: snapshot.val()})
                    });
                    
                } 

                else {
                    let score = Number(stringScore);
                    if(score <= 20) {  //20 is arbitrary.
                        getTopicName(topicPlain)
                        .then(snapshot => {
                            resolve({topicPlain: topicPlain, topicName: snapshot.val()})
                        });
                    } 
                    else resolve(""); //Perhaps it's not relevant if greater than 20.
                }
            }
        
        });
    }); 
    
}

function getTopicName(topicPlain) {
    return serverRef.child('topics').child(topicPlain).child('topicName').once('value');
}