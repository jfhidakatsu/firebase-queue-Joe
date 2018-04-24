const Queue = require('firebase-queue');
const firebase = require('firebase-admin');
const https = require('https');

var PROJECTS = ["morphus-app", "morphus-development"];

//SET TARGET PROJECT TO CHANGE DATABASES.
var TARGET = 1;

//Initialize Firebase
var serviceAccount = require("./" + PROJECTS[TARGET] + "-firebase-adminsdk.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://" + PROJECTS[TARGET] + ".firebaseio.com/"
});

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
    console.log("in getRelevantTopic");

    let inputString = data.text;
    

    getRelatedTopic(inputString)
    .then(outputString => responseRef.child("getRelevantTopic").child(data.requestId).set(outputString))
    .then(() => resolve());


});

function getRelatedTopic(string) {
    
    return new Promise((resolve, reject) => {
        try {

            const url = "https://p9pkey7d8d.execute-api.us-west-2.amazonaws.com/dev_api?q=" + string;
            https.get(url, res => {
                let body = "";
                res.on("data", data => {
                    body += data;
                });
                res.on("end", () => {
                    body = JSON.parse(body);
                    let mostRelevant = body[0][0];
                    let text = mostRelevant[0];
                    let stringScore = mostRelevant[2];

                    console.log('Most relevant match is ' + text);
                    console.log('Score is ' + stringScore);

                    //If there is no third entry, it seems the match is very strong.
                    if(!stringScore) resolve(text); 

                    else {
                        let score = Number(stringScore);
                        if(score <= 20) resolve(text); //20 is arbitrary. 
                        else resolve(""); //Perhaps it's not relevant if greater than 20.
                    }
                });
            });
        }

        catch(error) {
            reject(error);
        }
    });

        
    
}