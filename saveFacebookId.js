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
    saveFacebookId: {
        start_state: 'saveFacebookId',
        in_progress_state: 'saveFacebookId_in_progress'
    },
});

var saveFacebookIdOptions = {
    'specId': 'saveFacebookId'
};


var saveFacebookIdQueue = new Queue(queueRef, saveFacebookIdOptions, function (data, progress, resolve, reject) {
    let accessToken = data.accessToken;
    let facebookId = data.facebookId;
    let uid = data.uid;
    


    let url = "https://graph.facebook.com/v2.11/" + facebookId + "?fields=name,friends&access_token=" + accessToken;

    https.get(url, res => {
        let body = "";
        res.on("data", data => {
            body += data;
        });
        res.on("end", () => {
            let info = JSON.parse(body);
            let friends = info.friends.data;
            let friendsOutput = {};
            for(let i = 0; i < friends.length; i++) {
                friendsOutput[friends[i].id] = friends[i].name
            } 

            let userEntry = {
                uid: uid,
                name: info.name,
                friends: friendsOutput
            };

            serverRef.child('socialNetworks').child('facebook').child(facebookId).set(userEntry)
            .then(() => {
                let response = {
                    state: 1,
                    response: {
                        timestamp: new Date().toISOString(),
                        responseCode: {200: "No errors"}
                    }
                };
                firebase.database().ref('cloud-functions').child('saveFacebookId').child(uid).update(response)
                .then(() => resolve());
            });

        });
    });

});