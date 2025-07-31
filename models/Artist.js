const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Artist = sequelize.define('Artist', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                len: [1, 100]
            }
        }
    }, {
        tableName: 'artists',
        timestamps: true
    });

    return Artist;
}; 