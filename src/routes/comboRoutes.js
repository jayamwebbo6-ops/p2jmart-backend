const express = require('express');
const router = express.Router();
const comboController = require('../controllers/comboController');
const { protectAdmin } = require('../middleware/auth');

router.get('/', comboController.getAllCombos);
router.post('/', protectAdmin, comboController.createCombo);
router.put('/:id', protectAdmin, comboController.updateCombo);
router.patch('/:id/toggle-status', protectAdmin, comboController.toggleComboStatus);
router.delete('/:id', protectAdmin, comboController.deleteCombo);

module.exports = router;
