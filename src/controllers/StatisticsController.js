/**
 * Controller for statistics endpoints
 */
const service = require('../services/StatisticsService')

/**
 * Get distribution statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getDistribution (req, res) {
  const result = await service.getDistribution(req.query)
  res.send(result)
}

/**
 * Get member history statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getHistoryStats (req, res) {
  const result = await service.getHistoryStats(req.authUser, req.params.handle, req.query)
  res.send(result)
}

/**
 * Get member statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getMemberStats (req, res) {
  const result = await service.getMemberStats(req.authUser, req.params.handle, req.query, true)
  res.send(result)
}

/**
 * Get member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getMemberSkills (req, res) {
  const result = await service.getMemberSkills(req.params.handle)
  res.send(result)
}

/**
 * Create member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function createMemberSkills (req, res) {
  const result = await service.createMemberSkills(req.authUser, req.params.handle, req.body)
  res.send(result)
}

/**
 * Partially update member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function partiallyUpdateMemberSkills (req, res) {
  const result = await service.partiallyUpdateMemberSkills(req.authUser, req.params.handle, req.body)
  res.send(result)
}

module.exports = {
  getDistribution,
  getHistoryStats,
  getMemberStats,
  getMemberSkills,
  createMemberSkills,
  partiallyUpdateMemberSkills
}
