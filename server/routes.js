const express = require('express');
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

module.exports = function (db, io) {
  const router = express.Router();

  // Multer config for video uploads
  const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'video-' + uuidv4() + ext);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
      const allowed = /mp4|webm|ogg|mov/;
      const ext = allowed.test(path.extname(file.originalname).toLowerCase());
      const mime = allowed.test(file.mimetype.split('/')[1] || '');
      if (ext || mime || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed'));
      }
    }
  });

  // ========== TURN TYPES ==========
  router.get('/turn-types', (req, res) => {
    res.json(db.getAllTurnTypes());
  });

  // ========== AREAS ==========
  router.get('/areas', (req, res) => {
    res.json(db.getAllAreas());
  });

  // ========== OPERATORS ==========
  router.get('/operators', (req, res) => {
    res.json(db.getAllOperators());
  });

  // ========== CONFIG ==========
  router.get('/config', (req, res) => {
    res.json(db.getConfig());
  });

  router.post('/config', (req, res) => {
    try {
      const entries = req.body;
      for (const [key, value] of Object.entries(entries)) {
        db.setConfig(key, value);
      }
      io.emit('config-updated', db.getConfig());
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/config/upload-video', upload.single('video'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }
    const videoUrl = '/uploads/' + req.file.filename;
    db.setConfig('display_video_url', videoUrl);
    db.setConfig('display_video_enabled', 'true');
    io.emit('config-updated', db.getConfig());
    res.json({ success: true, url: videoUrl });
  });

  // ========== KIOSK - CREATE TURN ==========
  router.post('/turns', (req, res) => {
    try {
      const { turnTypeId, isPreferential, subType } = req.body;
      const turn = db.createTurn(turnTypeId, isPreferential, subType);
      io.emit('turn-created', turn);
      io.emit('kanban-update', db.getKanbanData());
      io.emit('display-update', db.getDisplayData());
      res.json(turn);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== KANBAN DATA ==========
  router.get('/kanban', (req, res) => {
    res.json(db.getKanbanData());
  });

  // ========== CALL TURN ==========
  router.post('/turns/:id/call', (req, res) => {
    try {
      const { areaId, operatorId } = req.body;
      const turn = db.callTurn(parseInt(req.params.id), areaId, operatorId);
      io.emit('turn-called', turn);
      io.emit('kanban-update', db.getKanbanData());
      io.emit('display-update', db.getDisplayData());
      res.json(turn);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== TRANSFER TURN ==========
  router.post('/turns/:id/transfer', (req, res) => {
    try {
      const { toAreaId, operatorId } = req.body;
      const turn = db.transferTurn(parseInt(req.params.id), toAreaId, operatorId);
      io.emit('turn-transferred', turn);
      io.emit('kanban-update', db.getKanbanData());
      io.emit('display-update', db.getDisplayData());
      res.json(turn);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== COMPLETE TURN ==========
  router.post('/turns/:id/complete', (req, res) => {
    try {
      const { operatorId } = req.body;
      const turn = db.completeTurn(parseInt(req.params.id), operatorId);
      io.emit('turn-completed', turn);
      io.emit('kanban-update', db.getKanbanData());
      io.emit('display-update', db.getDisplayData());
      res.json(turn);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== CANCEL TURN ==========
  router.post('/turns/:id/cancel', (req, res) => {
    try {
      const { operatorId } = req.body;
      const turn = db.cancelTurn(parseInt(req.params.id), operatorId);
      io.emit('turn-cancelled', turn);
      io.emit('kanban-update', db.getKanbanData());
      io.emit('display-update', db.getDisplayData());
      res.json(turn);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== DISPLAY DATA ==========
  router.get('/display', (req, res) => {
    res.json(db.getDisplayData());
  });

  // ========== STATS ==========
  router.get('/stats', (req, res) => {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    res.json(db.getStatsData(start, end));
  });

  router.get('/stats/excel', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];
      const data = db.getStatsData(start, end);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'E-TURNS';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Estadísticas de Turnos');

      // Header style
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };

      sheet.columns = [
        { header: 'Código', key: 'code', width: 12 },
        { header: 'Tipo de Turno', key: 'turn_type', width: 20 },
        { header: 'Preferencial', key: 'is_preferential', width: 14 },
        { header: 'Sub-Tipo', key: 'sub_type', width: 18 },
        { header: 'Hora de Llegada', key: 'arrival_time', width: 20 },
        { header: 'Hora Llamado Facturación', key: 'called_facturacion_time', width: 24 },
        { header: 'Operador Facturación', key: 'operator_facturacion', width: 22 },
        { header: 'Hora Llamado Toma de Muestra', key: 'called_toma_time', width: 28 },
        { header: 'Operador Toma de Muestra', key: 'operator_toma', width: 24 },
        { header: 'Hora Completado', key: 'completed_time', width: 20 },
        { header: 'Estado', key: 'status', width: 14 }
      ];

      // Apply header style
      sheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
        cell.border = headerStyle.border;
      });
      sheet.getRow(1).height = 30;

      // Add data rows
      for (const row of data) {
        const statusMap = {
          'waiting': 'En Espera',
          'attending': 'Atendiendo',
          'waiting_area': 'Esperando Área',
          'completed': 'Completado',
          'cancelled': 'Cancelado'
        };
        sheet.addRow({
          code: row.code,
          turn_type: row.turn_type,
          is_preferential: row.is_preferential ? 'Sí' : 'No',
          sub_type: row.sub_type || '-',
          arrival_time: row.arrival_time || '-',
          called_facturacion_time: row.called_facturacion_time || '-',
          operator_facturacion: row.operator_facturacion || '-',
          called_toma_time: row.called_toma_time || '-',
          operator_toma: row.operator_toma || '-',
          completed_time: row.completed_time || '-',
          status: statusMap[row.status] || row.status
        });
      }

      // Style data rows
      for (let i = 2; i <= sheet.rowCount; i++) {
        sheet.getRow(i).eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        if (i % 2 === 0) {
          sheet.getRow(i).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
          });
        }
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=estadisticas-turnos-${start}-a-${end}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
