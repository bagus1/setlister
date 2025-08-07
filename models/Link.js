const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Link = sequelize.define('Link', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    songId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'songs',
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('youtube', 'spotify', 'lyrics', 'tab', 'bass tab', 'chords', 'tutorial', 'other'),
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            len: [0, 255]
        }
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            isUrl: true
        }
    }
}, {
    tableName: 'links',
    timestamps: true
});

module.exports = Link; 