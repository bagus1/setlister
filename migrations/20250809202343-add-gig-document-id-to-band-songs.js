'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add gigDocumentId column to band_songs table
    await queryInterface.addColumn('band_songs', 'gigDocumentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'gig_documents',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the column (reverses the migration)
    await queryInterface.removeColumn('band_songs', 'gigDocumentId');
  }
};
