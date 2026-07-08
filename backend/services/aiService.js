const { pool } = require('../models/db');

// === SERVICIO DE IA ===
// Genera insights inteligentes basados en datos del usuario

/**
 * Generar resumen diario personalizado
 * Analiza: finanzas, hábitos, metas, estado de ánimo
 */
async function generateDailyInsight(userId) {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    // 1. Analizar finanzas de hoy
    const finanzasHoy = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END) as gastos
       FROM finanzas
       WHERE user_id = $1 AND fecha = $2`,
      [userId, hoy]
    );

    const { ingresos, gastos } = finanzasHoy.rows[0];
    const balance = ingresos - gastos;

    // 2. Analizar hábitos completados hoy
    const habitosHoy = await pool.query(
      `SELECT COUNT(*) as total FROM habito_logs
       WHERE user_id = $1 AND fecha = $2 AND completado = true`,
      [userId, hoy]
    );
    const habitosCompletados = parseInt(habitosHoy.rows[0].total);

    // 3. Analizar tendencias de gastos esta semana
    const gastosEstaSemana = await pool.query(
      `SELECT COUNT(*) as count, COUNT(DISTINCT clasificacion) as tipos
       FROM finanzas
       WHERE user_id = $1 AND tipo = 'gasto'
       AND fecha >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );
    const gastosEstaSemanaCount = parseInt(gastosEstaSemana.rows[0].count);

    // 4. Detectar patrones
    const patrones = detectarPatrones(
      balance,
      habitosCompletados,
      gastosEstaSemanaCount
    );

    // 5. Generar mensaje personalizado
    const insight = generarMensajeInsight(
      balance,
      habitosCompletados,
      patrones
    );

    // 6. Guardar en BD
    await pool.query(
      `INSERT INTO ai_insights (user_id, tipo, contenido, fecha_generado)
       VALUES ($1, $2, $3, NOW())`,
      [userId, 'diario', insight]
    );

    return insight;
  } catch (error) {
    console.error('Error generando insight:', error);
    return 'Resumen: Sigue adelante con tu progreso personal 💪';
  }
}

/**
 * Generar resumen semanal
 */
async function generateWeeklyInsight(userId) {
  try {
    // Últimos 7 días
    const finanzasSemana = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END) as gastos
       FROM finanzas
       WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const { ingresos: ingresosSem, gastos: gastosSem } = finanzasSemana.rows[0];
    const balanceSem = ingresosSem - gastosSem;

    // Hábitos de la semana
    const habitosSemana = await pool.query(
      `SELECT COUNT(*) as total FROM habito_logs
       WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '7 days' AND completado = true`,
      [userId]
    );
    const habitosTotalSem = parseInt(habitosSemana.rows[0].total);

    // Progreso de metas
    const metasProgress = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN estado = 'completado' THEN 1 END) as completadas
       FROM metas
       WHERE user_id = $1 AND estado != 'pausado'`,
      [userId]
    );

    const metasData = metasProgress.rows[0];
    const metasCompletadas = parseInt(metasData.completadas);

    // Generar resumen semanal
    const insight = `
📊 RESUMEN SEMANAL

💰 Finanzas:
• Ingresos: Q ${ingresosSem.toFixed(2)}
• Gastos: Q ${gastosSem.toFixed(2)}
• Balance: Q ${balanceSem.toFixed(2)}

🔥 Hábitos:
• Completados esta semana: ${habitosTotalSem}
• Promedio diario: ${(habitosTotalSem / 7).toFixed(1)}

🎯 Metas:
• Activas: ${metasData.total - metasCompletadas}
• Completadas: ${metasCompletadas}

${balanceSem > 0 ? '✅ Excelente semana financiera! Mantén el ritmo.' : '⚠️ Revisa tus gastos esta semana.'}
${habitosTotalSem >= 14 ? '🔥 Increíble! Completaste muchos hábitos.' : '💪 Sigue trabajando en tus hábitos.'}
    `;

    // Guardar en BD
    await pool.query(
      `INSERT INTO ai_insights (user_id, tipo, contenido, fecha_generado)
       VALUES ($1, $2, $3, NOW())`,
      [userId, 'semanal', insight]
    );

    return insight;
  } catch (error) {
    console.error('Error en weekly insight:', error);
    return 'Resumen semanal: Sigue avanzando 💚';
  }
}

/**
 * Detectar patrones en el comportamiento del usuario
 */
function detectarPatrones(balance, hábitos, gastos) {
  const patrones = [];

  if (balance > 0) {
    patrones.push('balance_positivo');
  } else if (balance < -500) {
    patrones.push('gasto_alto');
  }

  if (hábitos >= 5) {
    patrones.push('muchos_habitos');
  } else if (hábitos <= 1) {
    patrones.push('pocos_habitos');
  }

  if (gastos >= 10) {
    patrones.push('gastos_frecuentes');
  }

  return patrones;
}

/**
 * Generar mensaje personalizado basado en patrones
 */
function generarMensajeInsight(balance, habitos, patrones) {
  let mensaje = '📊 **Resumen de Hoy**\n\n';

  // Finanzas
  if (balance > 0) {
    mensaje += `💚 **Finanzas**: Gastaste menos hoy! Balance: Q ${balance.toFixed(2)}\n`;
  } else if (balance < 0) {
    mensaje += `⚠️ **Finanzas**: Gastos por Q ${Math.abs(balance).toFixed(2)}\n`;
  } else {
    mensaje += `➡️ **Finanzas**: Balance neutral hoy\n`;
  }

  // Hábitos
  if (habitos >= 5) {
    mensaje += `🔥 **Hábitos**: ¡Excelente! Completaste ${habitos} hábitos hoy!\n`;
  } else if (habitos > 0) {
    mensaje += `✓ **Hábitos**: Completaste ${habitos} hábito(s) hoy\n`;
  } else {
    mensaje += `💪 **Hábitos**: No completaste hábitos hoy. Mañana es un nuevo día!\n`;
  }

  // Mensajes motivacionales
  if (patrones.includes('balance_positivo') && patrones.includes('muchos_habitos')) {
    mensaje += `\n🎉 ¡Excelente día! Estás en el camino correcto.`;
  } else if (patrones.includes('gasto_alto')) {
    mensaje += `\n💡 Revisa tus gastos. Pequeños cambios hacen diferencia.`;
  } else if (patrones.includes('muchos_habitos')) {
    mensaje += `\n🌟 Tus hábitos están en excelente forma!`;
  }

  mensaje += `\n\n💚 Sigue mejorando 1% cada día!`;

  return mensaje;
}

/**
 * Predicción: ¿Cuándo alcanzarás tu meta?
 */
async function predictMetaCompletion(userId, metaId) {
  try {
    // Obtener meta
    const metaResult = await pool.query(
      'SELECT objetivo_cantidad FROM metas WHERE id = $1 AND user_id = $2',
      [metaId, userId]
    );

    if (metaResult.rows.length === 0) return null;

    const meta = metaResult.rows[0];

    // Promedio de ahorro mensual
    const ahorroMensual = await pool.query(
      `SELECT AVG(ahorro_mes) as promedio FROM (
        SELECT SUM(cantidad) as ahorro_mes
        FROM finanzas
        WHERE user_id = $1 AND meta_id = $2 AND tipo = 'ingreso'
        GROUP BY DATE_TRUNC('month', fecha)
      ) t`,
      [userId, metaId]
    );

    const promedio = parseFloat(ahorroMensual.rows[0]?.promedio) || 0;

    if (promedio <= 0) {
      return 'Sin datos de ahorro aún. ¡Comienza a ahorrar!';
    }

    const mesesRestantes = Math.ceil(meta.objetivo_cantidad / promedio);
    const fechaEstimada = new Date();
    fechaEstimada.setMonth(fechaEstimada.getMonth() + mesesRestantes);

    return `Alcanzarás tu meta en aproximadamente ${mesesRestantes} meses (${fechaEstimada.toLocaleDateString('es-ES')})`;
  } catch (error) {
    console.error('Error en predicción:', error);
    return 'Predicción: Continúa ahorrando para alcanzar tu meta';
  }
}

module.exports = {
  generateDailyInsight,
  generateWeeklyInsight,
  predictMetaCompletion,
  detectarPatrones
};
