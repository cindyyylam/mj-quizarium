var express = require("express");
var app = express();
var bodyParser = require("body-parser");
const axios = require("axios");
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);

// import environment variables
require("dotenv").config();

//constants
const port = 3000;
const telegram_send_url = "https://api.telegram.org/bot" + process.env.BOT_TOKEN + "/sendMessage";
const telegram_delete_url = "https://api.telegram.org/bot" + process.env.BOT_TOKEN + "/deleteMessage";

// db
const db = require("./db/mongoDb.js");

// messages
const PRIVATE_COMMAND_ONLY_MESSAGE = command =>
    `The command ${command} can only be used in a private chat.`;
const GAME_ALREADY_IN_PLAY_MESSAGE = "A game is already in play.";
const START_GAME_MESSAGE = noOfRounds => `${noOfRounds} rounds! Let's begin! You can extend the game using the \/extend command.`;
const STOP_GAME_MESSAGE = "The current game has been stopped.";
const NO_GAME_IN_PLAY_MESSAGE = "No game is currently in play.";
const HELP_MESSAGE =
    "Welcome to *MJ Quizarium*!\nHere is a list of commands to help you.\n\n/start - Start a new game\n/stop - Stop the current game\n/add - Add a new question\n/help - Send help lol";
const ADD_QUESTION_MESSAGE =
    "Let's add a new question. Please use this format:\n\n_question - answer_\nExample: _When was NTU MJ formed? - 1993_";
const ADD_SUCCESS_MESSAGE =
    "The new question has been successfully added. Thank you! :)";
const ADD_FAILURE_MESSAGE =
    "That's not a valid format. Please use this format:\n\n_When was NTU MJ formed?_ - _1993_";
const END_GAME_MESSAGE = "GAME END!!!";

// state machine
let GAME_STATES = {
    GAME_NOT_IN_PLAY: "GAME_NOT_IN_PLAY",
    GAME_IN_PLAY: "GAME_IN_PLAY",
    ADDING_QUESTION: "ADDING_QUESTION"
};

// question id map
let questionMap = new Map();

// timeout map
let timeOutMap = new Map();

app.post("/", (req, res) => {
    res.status(200);

    console.log("message received:", req.body);
    const { message } = req.body;

    if (message) {
        const text = message.text.toLowerCase();

        if (text.match(/^(\/start|\/start@mjquizariumbot$)/)) {
            db.selectState(message.chat.id)
                .then(row => {
                    let state = row;
                    if (!state) {
                        state = {
                            chatId: message.chat.id,
                            gameState: GAME_STATES.GAME_IN_PLAY
                        };
                        db.insertState(state).catch(err =>
                            console.log(
                                "index > /start > insertState > ERROR:",
                                err.message
                            )
                        );
                    } else if (state.gameState === GAME_STATES.GAME_IN_PLAY) {
                        sendMessage(message.chat.id, GAME_ALREADY_IN_PLAY_MESSAGE, res);
                        return;
                    } else {
                        state = {
                            ...state,
                            gameState: GAME_STATES.GAME_IN_PLAY
                        };
                        db.updateState(state).catch(err =>
                            console.log(
                                "index > /start > updateState > ERROR:",
                                err.message
                            )
                        );
                    }
                    console.log("index > /start > STATE:", state);

                    startGame(message, state, res);
                })
                .catch(err => console.log("index > /start > ERROR:", err.message));
        } else if (text.match(/^(\/stop|\/stop@mjquizariumbot)$/)) {
            db.selectState(message.chat.id)
                .then(row => {
                    let state = row;
                    if (!state) {
                        state = {
                            chatId: message.chat.id,
                            gameState: GAME_STATES.GAME_NOT_IN_PLAY
                        };
                        db.insertState(state).catch(err =>
                            console.log(
                                "index > /stop > insertState > ERROR:",
                                err.message
                            )
                        );
                    }
                    console.log("index > /stop > STATE:", state);

                    stop(message, state, res);
                })
                .catch(err => console.log("index > /stop > ERROR:", err.message));
        } else if (text.match(/^\/extend$/)) {
            db.selectState(message.chat.id)
                .then(row => {
                    let state = row;

                    if (state.gameState !== GAME_STATES.GAME_IN_PLAY) {
                        return;
                    }

                    let questionState = questionMap.get(message.chat.id);
                    let {
                        noOfRounds,
                        questions
                    } = questionState;
                    noOfRounds += 10;
                    if (noOfRounds > questions.length) {
                        noOfRounds = questions.length;
                        sendMessage(message.chat.id, `Game extended to ${noOfRounds} rounds! (There are only ${questions.length} questions available right now.)`, res);
                    } else {
                        sendMessage(message.chat.id, `Game extended to ${noOfRounds} rounds!`, res);
                    }
                    questionState = {
                        ...questionState,
                        noOfRounds
                    }
                    questionMap.set(message.chat.id, questionState);
                })
                .catch(err =>
                    console.log(
                        "index > /extend > selectState > ERROR:",
                        err.message
                    )
                );
        } else if (text.match(/^\/add$/)) {
            db.selectState(message.chat.id)
                .then(row => {
                    let state = row;
                    if (!state) {
                        state = {
                            chatId: message.chat.id,
                            gameState: GAME_STATES.GAME_NOT_IN_PLAY
                        };
                        db.insertState(state).catch(err =>
                            console.log(
                                "index > /add > insertState > ERROR:",
                                err.message
                            )
                        );
                    }
                    console.log("index > /add > STATE:", state);

                    add(message, state, res);
                })
                .catch(err => console.log("index > /add > ERROR:", err.message));
        } else if (text.match(/^\/help$/)) {
            if (message.chat.type !== "private") {
                return;
            }

            help(message, res);
        } else if (text.match(/^\/help@mjquizariumbot$/)) {
            help(message, res);
        } else if (!text.startsWith("/")) {
            db.selectState(message.chat.id)
                .then(row => {
                    let state = row;
                    if (!state) {
                        state = {
                            chatId: message.chat.id,
                            gameState: GAME_STATES.GAME_NOT_IN_PLAY
                        };
                        db.insertState(state).catch(err =>
                            console.log(
                                "index > message > insertState > ERROR:",
                                err.message
                            )
                        );
                    }
                    console.log("index > message > STATE:", state);

                    switch (state.gameState) {
                        case GAME_STATES.GAME_IN_PLAY:
                            console.log("ANSWERING QUESTION");
                            answerQuestion(message, state, res);
                            break;
                        case GAME_STATES.ADDING_QUESTION:
                            console.log("ADDING QUESTION");
                            addQuestion(message, state, res);
                            break;
                        default:
                            break;
                    }
                })
                .catch(err => console.log("index > message > ERROR:", err.message));
        }
    } else {
        res.send({});
    }    

});

app.listen(port, () => {
    // console.log(`Listening on port ${port}`);
})

const stop = (message, state, res) => {
    let { chat } = message;

    if (state.gameState === GAME_STATES.GAME_IN_PLAY) {
        let timeoutObj = timeOutMap.get(chat.id);
        clearTimeout(timeoutObj);
        timeOutMap.delete(chat.id);
        questionMap.delete(chat.id);
        sendMessage(chat.id, STOP_GAME_MESSAGE, res);
    } else if (state.gameState === GAME_STATES.GAME_NOT_IN_PLAY) {
        sendMessage(chat.id, NO_GAME_IN_PLAY_MESSAGE, res);
    } else {
        sendMessage(chat.id, "Stopping...", res);
    }

    state = {
        ...state,
        gameState: GAME_STATES.GAME_NOT_IN_PLAY
    };
    db.updateState(state).catch(err =>
        console.log("index > stop > updateState > ERROR:", err.message)
    );
};

const add = (message, state, res) => {
    let { text, chat } = message;

    if (chat.type !== "private") {
        sendMessage(chat.id, PRIVATE_COMMAND_ONLY_MESSAGE(text), res);
        return;
    }

    state = {
        ...state,
        gameState: GAME_STATES.ADDING_QUESTION
    };
    db.updateState(state).catch(err =>
        console.log("index > add > updateState > ERROR:", err.message)
    );

    sendMessage(chat.id, ADD_QUESTION_MESSAGE, res);
};

const addQuestion = (message, state, res) => {
    let { text, from, chat } = message;

    console.log("index > addQuestion > QUESTION:", text);
    let arr = text.split(" - ");
    if (arr.length !== 2) {
        sendMessage(chat.id, ADD_FAILURE_MESSAGE, res);
        return;
    }

    let question = {
        question: arr[0],
        answer: arr[1],
        author: from.first_name,
        username: from.username
    };
    db.insertQuestion(question).catch(err =>
        console.log(
            "index > addQuestion > insertQuestion > ERROR:",
            err.message
        )
    );

    state = {
        ...state,
        gameState: GAME_STATES.GAME_NOT_IN_PLAY
    };
    db.updateState(state).catch(err =>
        console.log("index > addQuestion > updateState > ERROR:", err.message)
    );

    sendMessage(chat.id, ADD_SUCCESS_MESSAGE, res);
};

const help = (message, res) => {
    let { chat } = message;

    sendMessage(chat.id, HELP_MESSAGE, res);
};

const startGame = (message, state, res) => {
    let chatId = message.chat.id;

    db.selectQuestions()
        .then(rows => {
            console.log("index > startGame > ROWS:", rows);
            if (!rows.length) {
                sendMessage(chatId, "There are currently no questions in the database.", res);
                return;
            }

            let noOfRounds = 10;

            let questionArr = [];
            if (rows.length < noOfRounds) {
                noOfRounds = rows.length;
            }

            let maxLength = rows.length;
            while (questionArr.length < maxLength) {
                let randomIndex = Math.floor(Math.random() * rows.length);
                questionArr.push(rows[randomIndex]);
                rows.splice(randomIndex, 1);
            }

            console.log("index > startGame > QUESTION ARRAY:", questionArr);

            questionMap.set(chatId, {
                currentQuestionNo: 1,
                currentHintNo: 0,
                noOfRounds,
                questions: questionArr
            });
            console.log("index > startGame > QUESTION MAP:", questionMap);

            sendMessage(chatId, START_GAME_MESSAGE(noOfRounds), res);
            setTimeout(function() {
                sendQuestion(chatId, res);
            }, 3000);
        })
        .catch(err => console.log("index > startGame > ERROR:", err.message));
};

const sendQuestion = (chatId, res) => {
    let questionState = questionMap.get(chatId);
    console.log("index > sendQuestion > QUESTION STATE:", questionState);

    let {
        currentQuestionNo,
        currentHintNo,
        noOfRounds,
        questions
    } = questionState;

    if (!questions[currentQuestionNo - 1]) {
        endGame(chatId, res);
        return;
    }

    let { question, answer, author, username } = questions[
        currentQuestionNo - 1
    ];

    let template = `❓ *QUESTION* ${currentQuestionNo}/${noOfRounds}\n${question} - _by ${author} (@${username})_\n`;

    switch (currentHintNo) {
        case 0:
            template += `\n⏱ ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜`;
            break;
        case 1:
            template += `Hint: ${answer
                .split("")
                .map(char => char.replace(/[^\s]/g, "\\_"))
                .join(" ")}\n`;
            template += `\n⏱ ⬛⬛⬛⬜⬜⬜⬜⬜⬜⬜`;
            break;
        case 2:
            let ansArr = answer.split("");
            for (
                let i = 0;
                i < Math.ceil((answer.replace(/ /g, "").length / 3) * 2);
                i++
            ) {
                let randInd;
                do {
                    randInd = Math.floor(Math.random() * ansArr.length);
                } while (ansArr[randInd] === "\\_" || ansArr[randInd] === " ");
                ansArr[randInd] = "\\_";
            }
            template += `Hint: ${ansArr.join(" ")}\n`;
            template += `\n⏱ ⬛⬛⬛⬛⬛⬛⬜⬜⬜⬜`;
            break;
        case 3:
            template = `❎ Nobody gave the correct answer. The correct answer is *${answer}*!\n`;
            break;
    }

    console.log("index > sendQuestion > TEMPLATE:", template);

    sendMessage(chatId, template, res);
    
    // update question map
    if (currentHintNo === 3) {
        questionState = {
            ...questionState,
            currentQuestionNo: currentQuestionNo + 1,
            currentHintNo: 0
        };
        questionMap.set(chatId, questionState);

        let timeoutObj = timeOutMap.get(chatId);
        clearTimeout(timeoutObj);
        timeOutMap.delete(chatId);

        setTimeout(function() {
            sendQuestion(chatId, res);
        }, 3000);
    } else {
        questionState = {
            ...questionState,
            currentHintNo: currentHintNo + 1
        };
        questionMap.set(chatId, questionState);

        // set timeout
        let timeoutObject = setTimeout(function () {
            sendQuestion(chatId, res);
        }, 20000);
        timeOutMap.set(chatId, timeoutObject);
    }
};

const answerQuestion = (message, state, res) => {
    let { text, chat } = message;

    let questionState = questionMap.get(chat.id);
    console.log("index > answerQuestion > QUESTION STATE:", questionState);

    if (!questionState) {
        state = {
            ...state,
            gameState: GAME_STATES.GAME_NOT_IN_PLAY
        };
        db.updateState(state).catch(err =>
            console.log(
                "index > answerQuestion > updateState > ERROR:",
                err.message
            )
        );

        sendMessage(chat.id, "Please restart game.", res);
        return;
    }

    let { currentQuestionNo, noOfRounds, questions } = questionState;
    let { answer } = questions[currentQuestionNo - 1];

    if (answer.toLowerCase() === text.toLowerCase()) {
        let timeoutObj = timeOutMap.get(chat.id);
        clearTimeout(timeoutObj);
        timeOutMap.delete(chat.id);

        let message = `✅ Yes, the correct answer is *${answer}*!`;

        sendMessage(chat.id, message, res);

        if (currentQuestionNo === noOfRounds) {
            endGame(chat.id, res);
            return;
        }

        questionState = {
            ...questionState,
            currentQuestionNo: currentQuestionNo + 1,
            currentHintNo: 0
        };
        questionMap.set(chat.id, questionState);
        console.log(
            "index > answerQuestion > UPDATE QUESTION STATE:",
            questionState
        );

        setTimeout(function () {
            sendQuestion(chat.id, res);
        }, 5000);
    }
};

const endGame = (chatId, res) => {
    // update state in db
    let state = {
        chatId,
        gameState: GAME_STATES.GAME_NOT_IN_PLAY
    };
    db.updateState(state)
        .then(() => {
            // update question map
            questionMap.delete(chatId);

            // show leaderboards maybe
            sendMessage(chatId, END_GAME_MESSAGE, res);
        })
        .catch(err =>
            console.log("index > endGame > updateState > ERROR:", err.message)
        );
};

const sendMessage = (chatId, reply, res, opts = {}) => {
    axios.post(telegram_send_url, 
        {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown",
            ...opts
        })
        .then(response => {
            res.send({});
        })
        .catch(err => {
            console.log("index > sendMessage > ERROR:", err.message);
        })
}