const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const MONGODB_DB_NAME = "mj-quizarium";
const MONGODB_STATE_COLLECTION_NAME = "state";
const MONGODB_QUESTION_COLLECTION_NAME = "question";
const MONGODB_USER_COLLECTION_NAME = "user";

const mongoDb = {
	selectState(chatId) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > selectState > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_STATE_COLLECTION_NAME);
				collection
					.findOne({
						chatId: chatId
					})
					.then(res => {
						console.log("db > selectState > RESULT:", res);
						resolve(res);
					})
					.catch(err => {
						reject("db > selectState > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	insertState({ chatId, gameState }) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > insertState > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_STATE_COLLECTION_NAME);
				collection
					.insertOne({
						chatId: chatId,
						gameState: gameState
					})
					.then(res => {
						resolve(res);
					})
					.catch(err => {
						reject("db > insertState > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	updateState({ chatId, gameState }) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > updateState > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_STATE_COLLECTION_NAME);
				collection
					.updateOne({ chatId: chatId }, { $set: { gameState: gameState } })
					.then(res => {
						resolve(res);
					})
					.catch(err => {
						reject("db > updateState > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	insertQuestion({ question, answer, author, username }) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > insertQuestion > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_QUESTION_COLLECTION_NAME);
				collection
					.insertOne({
						question: question,
						answer: answer,
						author: author,
						username: username
					})
					.then(res => {
						resolve(res);
					})
					.catch(err => {
						reject("db > insertQuestion > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	findQuestion(question) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > findQuestion > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_QUESTION_COLLECTION_NAME);
				collection
					.findOne({
						question: question
					})
					.then(res => {
						console.log("db > findQuestion > RESULT:", res);
						resolve(res);
					})
					.catch(err => {
						reject("db > findQuestion > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	deleteQuestion(question) {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > deleteQuestion > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_QUESTION_COLLECTION_NAME);
				collection
					.deleteOne({
						question: question
					})
					.then(res => {
						resolve(res);
					})
					.catch(err => {
						reject("db > deleteQuestion > ERROR2:", err.message);
					});
				client.close();
			});
		});
	},

	selectQuestions() {
		return new Promise((resolve, reject) => {
			client.connect(err => {
				if (err) return reject("db > selectQuestions > ERROR:", err.message);
				const collection = client
					.db(MONGODB_DB_NAME)
					.collection(MONGODB_QUESTION_COLLECTION_NAME);
				collection
					.find({})
					.toArray()
					.then(res => {
						console.log("db > selectQuestions > RESULT:", res);
						resolve(res);
					})
					.catch(err => {
						reject("db > selectQuestions > ERROR2:", err.message);
					});
				client.close();
			});
		});
	}
};

module.exports = mongoDb;
