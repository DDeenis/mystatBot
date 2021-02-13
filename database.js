/*jshint globalstrict: true*/

'use strict';

// const Enumerable = require('linq');

const {
    Sequelize,
    DataTypes,
    Model
} = require('sequelize');

//////////////// START CONNECTION TO DB ////////////////

const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.BOT_DB_NAME;

const sequelize = new Sequelize(dbName, dbUsername, dbPassword, {
    host: 'localhost',
    dialect: 'mysql',
    // logging: console.log,
});

async function ensureConnection() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

// ensureConnection();

//////////////// END CONNECTION TO DB ////////////////

//////////////// START MODELS ////////////////

class UserData extends Model {}

UserData.init({
    chatId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    mystatLogin: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mystatPassword: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "UserData"
});

async function syncUserModel() {
    try {
        await sequelize.sync({ alter: true });
        console.log("Models synchronized successfully");
    } catch (error) {
        console.log("Model synchronization failed", error);
    }
}

// syncUserModel();

//////////////// END MODELS ////////////////

//////////////// START DATA FUNCTIONS ////////////////

async function createUser(username, password, chatId) {
    try {
        await UserData.create({
            mystatLogin: username,
            mystatPassword: password,
            chatId: chatId
        });

        return true;
    } catch (error) {
        console.log(`Error when creation user ${username}`, error);

        return false;
    }
}

async function deleteUser(chatId)
{
    try {
        await UserData.destroy({
            where: {
                chatId: chatId
            }
        });

        return true;
    } catch (error) {
        console.log(`Error when deleting user with id ${chatId}`, error);

        return false;
    }
}

async function getAllUsers() {
    return await UserData.findAll();
}

async function getUserByChat(chatId) {
    return await UserData.findAll({
        where: {
            chatId: chatId
        }
    });
}

async function checkDatabase() {
    try {
        await ensureConnection();
        await syncUserModel();

        return true;
    } catch (error) {
        console.log(error);

        return false;
    }
}

//////////////// END DATA FUNCTIONS ////////////////

//////////////// START EXPORTS ////////////////

module.exports = {
    createUser,
    deleteUser,
    getAllUsers,
    getUserByChat,
    checkDatabase
};

//////////////// END EXPORTS ////////////////
