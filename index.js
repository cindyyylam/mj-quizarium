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
const port = process.env.PORT || 5000;
const telegram_send_url = "https://api.telegram.org/bot" + process.env.BOT_TOKEN + "/sendMessage";

// db
const db = require("./db/mongoDb.js");

// messages
const PRIVATE_COMMAND_ONLY_MESSAGE = command =>
    `The command ${command} can only be used in a private chat.`;
const GAME_ALREADY_IN_PLAY_MESSAGE = "A game is already in play.";
const GAME_CURRENTLY_IN_PLAY_MESSAGE = "A game is currently in play.";
const START_GAME_MESSAGE = noOfRounds => `${noOfRounds} rounds! Let's begin! You can extend the game using the \/extend command.`;
const STOP_GAME_MESSAGE = "The current game has been stopped.";
const NO_GAME_IN_PLAY_MESSAGE = "No game is currently in play.";
const HELP_MESSAGE =
    "Welcome to *MJ Quizarium*! 👊🏻👊🏼👊🏽👊🏾👊🏿\nHere is a list of commands to help you.\n\n/start - Start a new game\n/stop - Stop the current game\n/extend - Extend the game for another 10 rounds\n/add - Add a new question\n/help - Send help lol";
const ADD_QUESTION_MESSAGE =
    "Let's add a new question. Please use this format:\n\n_question - answer_\nExample: _When was NTU MJ formed? - 1993_";
const ADD_SUCCESS_MESSAGE =
    "The new question has been successfully added. Thank you! :)";
const ADD_FAILURE_MESSAGE =
    "That's not a valid format. Please use this format:\n\n_When was NTU MJ formed?_ - _1993_";
const END_GAME_MESSAGE = (pointsMap) => {
    let template = `Game Ended! 🎊\n\n🏆 The winners are:\n`;

    let pointsArray = [...pointsMap.values()];
    console.log("index > END_GAME_MESSAGE > POINTS ARRAY:", pointsArray);
    pointsArray.sort((a, b) => b.points-a.points).forEach(({ name, username, points, answers }, index) => {
        template += `     `;
        switch (index) {
            case 1:
                template += `🥇 `;
                break;
            case 2:
                template += `🥈 `;
                break;
            case 3:
                template += `🥉 `;
                break;
            default:
                template += `🏅 `;
                break;
        }
        template += `*${name}* - ${points} points _(${answers} answers)_\n`;
    })

    return template;
}
const LEADERBOARD_MESSAGE = (leaderboard) => {

}

// state machine
let GAME_STATES = {
    GAME_NOT_IN_PLAY: "GAME_NOT_IN_PLAY",
    GAME_IN_PLAY: "GAME_IN_PLAY",
    ADDING_QUESTION: "ADDING_QUESTION"
};

let stateMap = new Map();
let questionMap = new Map();
let timeOutMap = new Map();
let pointsMap = new Map();

app.post("/", async (req, res) => {
    res.status(200);

    console.log("MESSAGE RECEIVED:", req.body);
    const { message } = req.body;

    if (message) {
        const text = message.text.toLowerCase();

        if (text.match(/^(\/start|\/start@mjquizariumbot$)/)) {
            try {
                let state = stateMap.get(message.chat.id);
                if (!state) {
                    state = await db.selectState(message.chat.id);
                    stateMap.set(message.chat.id, state);
                }
                console.log("index > /start > STATE MAP:", stateMap);
                await start(message, state);
            } catch (e) {
                console.log("index > /start > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (text.match(/^(\/stop|\/stop@mjquizariumbot)$/)) {
            try {
                let state = stateMap.get(message.chat.id);
                if (!state) {
                    state = await db.selectState(message.chat.id);
                    stateMap.set(message.chat.id, state);
                }
                console.log("index > /stop > STATE MAP:", stateMap);
                await stop(message, state);
            } catch (e) {
                console.log("index > /stop > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (text.match(/^(\/extend|\/extend@mjquizariumbot)$/)) {
            try {
                let state = stateMap.get(message.chat.id);
                if (!state) {
                    state = await db.selectState(message.chat.id);
                    stateMap.set(message.chat.id, state);
                }
                console.log("index > /extend > STATE MAP:", stateMap);
                extend(message, state);
            } catch (e) {
                console.log("index > /extend > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (text.match(/^\/add$/)) {
            try {
                let state = stateMap.get(message.chat.id);
                if (!state) {
                    state = await db.selectState(message.chat.id);
                    stateMap.set(message.chat.id, state);
                }
                console.log("index > /add > STATE MAP:", stateMap);
                await add(message, state);
            } catch (e) {
                console.log("index > /add > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (text.match(/^\/help$/)) {
            try {
                if (message.chat.type !== "private") {
                    return;
                }

                help(message);
            } catch (e) {
                console.log("index > /help > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (text.match(/^\/help@mjquizariumbot$/)) {
            try {
                help(message);
            } catch (e) {
                console.log("index > /help@mjquizariumbot > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        } else if (!text.startsWith("/")) {
            try {
                let state = stateMap.get(message.chat.id);
                if (!state) {
                    state = await db.selectState(message.chat.id);
                    stateMap.set(message.chat.id, state);
                }
                console.log("index > message > STATE MAP:", stateMap);
                if (!state) return;

                switch (state.gameState) {
                    case GAME_STATES.GAME_IN_PLAY:
                        await answerQuestion(message);
                        break;
                    case GAME_STATES.ADDING_QUESTION:
                        await addQuestion(message);
                        break;
                    default:
                        break;
                }  
            } catch (e) {
                console.log("index > message > ERROR:", e.message);
            } finally {
                res.send({});
                return;
            }
        }
    }
    res.send({});  

});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})

const start = async (message, state) => {
    try {
        let chatId = message.chat.id;

        if (!state) {
            state = {
                chatId,
                gameState: GAME_STATES.GAME_IN_PLAY
            }
            await db.insertState(state);
            stateMap.set(chatId, { chatId, gameState: state.gameState });
        } else if (state.gameState === GAME_STATES.GAME_IN_PLAY) {
            sendMessage(chatId, GAME_ALREADY_IN_PLAY_MESSAGE);
            return;
        } else {
            state = {
                ...state,
                gameState: GAME_STATES.GAME_IN_PLAY
            };
            await db.updateState(state);
            stateMap.set(chatId, state);
        }

        let questions = await db.selectAllQuestions();

        if (!questions.length) {
            sendMessage(chatId, "There are currently no questions in the database.");
            return;
        }

        let noOfRounds = 10;

        let questionArr = [];
        if (questions.length < noOfRounds) {
            noOfRounds = questions.length;
        }

        let maxLength = questions.length;
        while (questionArr.length < maxLength) {
            let randomIndex = Math.floor(Math.random() * questions.length);
            questionArr.push(questions[randomIndex]);
            questions.splice(randomIndex, 1);
        }

        questionMap.set(chatId, {
            currentQuestionNo: 1,
            currentHintNo: 0,
            noOfRounds,
            questions: questionArr
        });

        sendMessage(chatId, START_GAME_MESSAGE(noOfRounds));
        setTimeout(function () {
            sendQuestion(chatId);
        }, 3000);
    } catch (e) {
        console.log("index > start > ERROR:", e.message);
    }
};

const stop = async (message, state) => {
    try {
        let chatId = message.chat.id;
        
        if (!state) {
            state = {
                chatId,
                gameState: GAME_STATES.GAME_NOT_IN_PLAY
            }
            await db.insertState(state);
            stateMap.set(chatId, { chatId, gameState: state.gameState });
            sendMessage(chatId, NO_GAME_IN_PLAY_MESSAGE);
        } else if (state.gameState === GAME_STATES.GAME_IN_PLAY) {
            let timeoutObj = timeOutMap.get(chatId);
            clearTimeout(timeoutObj);
            timeOutMap.delete(chatId);
            questionMap.delete(chatId);
            sendMessage(chatId, STOP_GAME_MESSAGE);
        } else if (state.gameState === GAME_STATES.GAME_NOT_IN_PLAY) {
            sendMessage(chatId, NO_GAME_IN_PLAY_MESSAGE);
        } else {
            sendMessage(chatId, "Stopping...");
        }

        if (state.gameState !== GAME_STATES.GAME_NOT_IN_PLAY) {
            state = {
                ...state,
                gameState: GAME_STATES.GAME_NOT_IN_PLAY
            };
            await db.updateState(state);
            stateMap.set(chatId, state);
        }
    } catch (e) {
        console.log("index > stop > ERROR:", e.message);
    }
};

const extend = (message, state) => {
    try {
        let chatId = message.chat.id;

        if (!state || state.gameState !== GAME_STATES.GAME_IN_PLAY) {
            sendMessage(chatId, NO_GAME_IN_PLAY_MESSAGE);
            return;
        }

        let questionState = questionMap.get(chatId);
        let { noOfRounds, questions } = questionState;

        noOfRounds += 10;
        if (noOfRounds > questions.length) {
            noOfRounds = questions.length;
            sendMessage(chatId, `Game extended to ${noOfRounds} rounds! (There are only ${questions.length} questions available right now.)`);
        } else {
            sendMessage(chatId, `Game extended to ${noOfRounds} rounds!`);
        }

        questionState = {
            ...questionState,
            noOfRounds
        };
        questionMap.set(chatId, questionState);
    } catch (e) {
        console.log("index > extend > ERROR:", e.message);
    }
}

const add = async (message, state) => {
    try {
        let { text, chat } = message;

        if (chat.type !== "private") {
            sendMessage(chat.id, PRIVATE_COMMAND_ONLY_MESSAGE(text));
            return;
        } else if (state && state.gameState === GAME_STATES.GAME_IN_PLAY) {
            sendMessage(chat.id, GAME_CURRENTLY_IN_PLAY_MESSAGE);
            return;
        }

        newState = { 
            chatId: chat.id, gameState: GAME_STATES.ADDING_QUESTION 
        };
        if (!state) {
            await db.insertState(newState);
        } else {
            await db.updateState(newState);
        }
        stateMap.set(chat.id, newState);


        sendMessage(chat.id, ADD_QUESTION_MESSAGE);
    } catch (e) {
        console.log("index > add > ERROR:", e.message)
    }
};

const addQuestion = async (message, state) => {
    try {
        let { text, from, chat } = message;
        console.log("index > addQuestion > QUESTION:", text);

        let arr = text.split(" - ");
        if (arr.length !== 2) {
            sendMessage(chat.id, ADD_FAILURE_MESSAGE);
            return;
        }

        let question = {
            question: arr[0],
            answer: arr[1],
            author: from.first_name,
            username: from.username
        };

        await db.insertQuestion(question);

        state = {
            ...state,
            gameState: GAME_STATES.GAME_NOT_IN_PLAY
        };
        await db.updateState(state);
        stateMap.set(chat.id, state);

        sendMessage(chat.id, ADD_SUCCESS_MESSAGE);
    } catch (e) {
        console.log("index > addQuestion > ERROR:", e.message);
    }
};

const help = (message) => {
    sendMessage(message.chat.id, HELP_MESSAGE);
};

const answerQuestion = async (message) => {
    try {
        let chatId = message.chat.id;
        let text = message.text;

        let questionState = questionMap.get(chatId);
        if (!questionState) return;

        let { currentQuestionNo, currentHintNo, noOfRounds, questions } = questionState;
        let { answer } = questions[currentQuestionNo - 1];

        if (text.toLowerCase().includes(answer.toLowerCase())) {
            let timeoutObj = timeOutMap.get(chatId);
            clearTimeout(timeoutObj);
            timeOutMap.delete(chatId);

            let points;
            switch (currentHintNo) {
                case 1:
                    points = 5;
                    break;
                case 2:
                    points = 3;
                    break;
                case 3:
                    points = 1;
                    break;
                default:
                    break;
            }
            let playerStats = pointsMap.get(message.from.id);
            if (playerStats) {
                pointsMap.set(message.from.id, { userId: message.from.id, name: message.from.first_name, username: message.from.username, points: playerStats.points + points, answers: playerStats.answers += 1 });
            } else {
                pointsMap.set(message.from.id, { userId: message.from.id, name: message.from.first_name, username: message.from.username, points, answers: 1 });
            }
            console.log("index > answerQuestion > POINTS MAP:", pointsMap);

            let reply = `✅ Yes, the correct answer is *${answer}*!\n\n🎉 ${message.from.first_name} +${points}`;
            sendMessage(chatId, reply);

            if (currentQuestionNo === noOfRounds) {
                await endGame(chatId);
                return;
            }

            questionState = {
                ...questionState,
                currentQuestionNo: currentQuestionNo + 1,
                currentHintNo: 0
            };
            questionMap.set(chatId, questionState);

            setTimeout(function () {
                sendQuestion(chatId);
            }, 5000);
        }
    } catch (e) {
        console.log("index > answerQuestion > ERROR:", e.message);
    }
};

const sendQuestion = (chatId) => {
    let questionState = questionMap.get(chatId);

    let {
        currentQuestionNo,
        currentHintNo,
        noOfRounds,
        questions
    } = questionState;

    if (!questions[currentQuestionNo - 1]) {
        endGame(chatId);
        return;
    }

    let { question, answer, author, username } = questions[
        currentQuestionNo - 1
    ];

    let template = `❓ *QUESTION* ${currentQuestionNo}/${noOfRounds}\n${question} - _by ${author}${username ? ` (@${username})` : ``}_\n`;

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

    sendMessage(chatId, template);

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

        setTimeout(function () {
            sendQuestion(chatId);
        }, 3000);
    } else {
        questionState = {
            ...questionState,
            currentHintNo: currentHintNo + 1
        };
        questionMap.set(chatId, questionState);

        // set timeout
        let timeoutObject = setTimeout(function () {
            sendQuestion(chatId);
        }, 20000);
        timeOutMap.set(chatId, timeoutObject);
    }
};

const endGame = async (chatId) => {
    try {
        let state = {
            chatId,
            gameState: GAME_STATES.GAME_NOT_IN_PLAY
        };

        sendMessage(chatId, END_GAME_MESSAGE(pointsMap));

        await db.updateState(state);
        stateMap.set(chatId, state);

        questionMap.delete(chatId);
        timeOutMap.delete(chatId);

        let leaderboard = await db.selectUsers([...pointsMap.keys()].map((key) => ({ userId: key })));
        console.log("index > endGame > OLD LEADERBOARD:", leaderboard);
        let newLeaderboard = pointsMap.map(({ userId, name, username, points, answers }) => {
            let existingUser = leaderboard.find(({ userId: id }) => id === userId);
            if (existingUser) {
                points += existingUser.points;
                answers += existingUser.answers;
            }
            return {
                userId,
                name,
                username,
                points,
                answers
            }
        })
        console.log("index > endGame > NEW LEADERBOARD:", newLeaderboard);
        await db.upsertLeaderboard(newLeaderboard);
        pointsMap = new Map();
        let overAllLeaderboard = await db.getLeaderboard();
        console.log("index > endGame > OVERALL LEADERBOARD:", overAllLeaderboard);
        sendMessage(chatId, LEADERBOARD_MESSAGE(overAllLeaderboard));
    } catch (e) {
        console.log("index > endGame > ERROR:", e.message);
    }
};

const sendMessage = (chatId, reply, opts = {}) => {
    axios.post(telegram_send_url, 
        {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown",
            ...opts
        })
        .then(response => {
            console.log("index > sendMessage > CHAT ID:", chatId);
            console.log("index > sendMessage > TEXT:", reply);
        })
        .catch(err => {
            console.log("index > sendMessage > ERROR:", err.message);
        })
}