const MongoClient = require("mongodb").MongoClient;
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const MONGODB_DB_NAME = "mj-quizarium";
const MONGODB_STATE_COLLECTION_NAME = "state";
const MONGODB_QUESTION_COLLECTION_NAME = "question";
const MONGODB_USER_COLLECTION_NAME = "user";

const mongoDb = {
	selectState: async (chatId) => {
		console.log("mongoDb > selectState > ", chatId);
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > selectState > ERROR: no monogDb client returned");
		
		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_STATE_COLLECTION_NAME);
			return await collection.findOne({ chatId });
		} catch (e) {
			console.log("mongoDb > selectState > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	insertState: async ({ chatId, gameState }) => {
		console.log("mongoDb > insertState > ", { chatId, gameState });
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > insertState > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_STATE_COLLECTION_NAME);
			return await collection.insertOne({ chatId, gameState });
		} catch (e) {
			console.log("mongoDb > insertState > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	updateState: async ({ chatId, gameState }) => {
		console.log("mongoDb > updateState > ", { chatId, gameState });
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > updateState > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_STATE_COLLECTION_NAME);
			return await collection.updateOne({ chatId }, { $set: { gameState } });
		} catch (e) {
			console.log("mongoDb > updateState > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	insertQuestion: async ({ question, answer, author, username }) => {
		console.log("mongoDb > insertQuestion > ", { question, answer, author, username });
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > insertQuestion > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_QUESTION_COLLECTION_NAME);
			return await collection.insertOne({ question, answer, author,username });
		} catch (e) {
			console.log("mongoDb > insertQuestion > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	selectAllQuestions: async () => {
		console.log("mongoDb > selectAllQuestions");
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > selectAllQuestions > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_QUESTION_COLLECTION_NAME);
			return await collection.find({}).toArray();
		} catch (e) {
			console.log("mongoDb > selectAllQuestions > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	upsertLeaderboard: async (leaderboard) => {
		console.log("mongoDb > upsertLeaderboard");
		console.log("mongoDb > upsertLeaderboard > LEADER BOARD:", leaderboard);
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > upsertLeaderboard > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_USER_COLLECTION_NAME);
			asyncForEach([...leaderboard.values()], async ({ userId, name, username, points, answers }) => {
				await collection.update(
					{ userId },
					{
						userId,
						name,
						username,
						points,
						answers
					},
					{ upsert: true }
				);
			});
			return;
		} catch (e) {
			console.log("mongoDb > upsertLeaderboard > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	selectUsers: async (userIdArray) => {
		console.log("mongoDb > selectUsers");
		console.log("mongoDb > selectUsers > USER ID ARRAY:", userIdArray);
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > selectUsers > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_USER_COLLECTION_NAME);
			return await collection.find(
				{
					$or: userIdArray
				}
			).toArray();
		} catch (e) {
			console.log("mongoDb > selectUsers > ERROR:", e.message);
		} finally {
			client.close();
		}
	},

	getLeaderboard: async () => {
		console.log("mongoDb > getLeaderboard");
		const client = await mongoClient.connect();
		if (!client) return console.log("mongoDb > getLeaderboard > ERROR: no monogDb client returned");

		try {
			const db = client.db(MONGODB_DB_NAME);
			let collection = db.collection(MONGODB_USER_COLLECTION_NAME);
			return await collection.find({}).toArray();
		} catch (e) {
			console.log("mongoDb > getLeaderboard > ERROR:", e.message);
		} finally {
			client.close();
		}
	}
};

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

module.exports = mongoDb;
