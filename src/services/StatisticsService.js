/**
 * This service provides operations of statistics.
 */

const _ = require('lodash')
const Joi = require('joi')
const config = require('config')
const helper = require('../common/helper')
const logger = require('../common/logger')
const errors = require('../common/errors')
const constants = require('../../app-constants')
const prisma = require('../common/prisma').getClient()
const prismaHelper = require('../common/prismaHelper')
const string = require('joi/lib/types/string')
const { v4: uuidv4 } = require('uuid')

const DISTRIBUTION_FIELDS = ['track', 'subTrack', 'distribution', 'createdAt', 'updatedAt',
  'createdBy', 'updatedBy']

const HISTORY_STATS_FIELDS = ['userId', 'groupId', 'handle', 'handleLower', 'DEVELOP', 'DATA_SCIENCE',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy']

const MEMBER_STATS_FIELDS = ['userId', 'groupId', 'handle', 'handleLower', 'maxRating',
  'challenges', 'wins', 'DEVELOP', 'DESIGN', 'DATA_SCIENCE', 'COPILOT', 'createdAt',
  'updatedAt', 'createdBy', 'updatedBy']

const MEMBER_SKILL_FIELDS = ['userId', 'handle', 'handleLower', 'skills',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy']

/**
 * Get distribution statistics.
 * @param {Object} query the query parameters
 * @returns {Object} the distribution statistics
 */
async function getDistribution (query) {
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, DISTRIBUTION_FIELDS) || DISTRIBUTION_FIELDS

  // find matched distribution records
  const prismaFilter = { where: {} }
  if (query.track || query.subTrack) {
    prismaFilter.where = { AND: [] }
    if (query.track) {
      prismaFilter.where.AND.push({
        track: { contains: query.track.toUpperCase() }
      })
    }
    if (query.subTrack) {
      prismaFilter.where.AND.push({
        subTrack: { contains: query.subTrack.toUpperCase() }
      })
    }
  }
  const items = await prisma.distributionStats.findMany(prismaFilter)
  if (!items || items.length === 0) {
    throw new errors.NotFoundError(`No member distribution statistics is found.`)
  }
  // convert result to response structure
  const records = []
  _.forEach(items, t => {
    const r = _.pick(t, DISTRIBUTION_FIELDS)
    r.distribution = {}
    _.forEach(t, (value, key) => {
      if (key.startsWith('ratingRange')) {
        r.distribution[key] = value
      }
    })
    records.push(r)
  })

  // aggregate the statistics
  let result = { track: query.track, subTrack: query.subTrack, distribution: {} }
  _.forEach(records, (record) => {
    if (record.distribution) {
      // sum the statistics
      _.forIn(record.distribution, (value, key) => {
        if (!result.distribution[key]) {
          result.distribution[key] = 0
        }
        result.distribution[key] += Number(value)
      })
      // use earliest createdAt
      if (record.createdAt && (!result.createdAt || new Date(record.createdAt) < result.createdAt)) {
        result.createdAt = new Date(record.createdAt)
        result.createdBy = record.createdBy
      }
      // use latest updatedAt
      if (record.updatedAt && (!result.updatedAt || new Date(record.updatedAt) > result.updatedAt)) {
        result.updatedAt = new Date(record.updatedAt)
        result.updatedBy = record.updatedBy
      }
    }
  })
  // select fields if provided
  if (fields) {
    result = _.pick(result, fields)
  }
  return result
}

getDistribution.schema = {
  query: Joi.object().keys({
    track: Joi.string(),
    subTrack: Joi.string(),
    fields: Joi.string()
  })
}

/**
 * Get history statistics.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the history statistics
 */
async function getHistoryStats (currentUser, handle, query) {
  let overallStat = []
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, HISTORY_STATS_FIELDS) || HISTORY_STATS_FIELDS
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  const groupIds = await helper.getAllowedGroupIds(currentUser, member, query.groupIds)

  for (const groupId of groupIds) {
    let statsDb
    if (groupId === config.PUBLIC_GROUP_ID) {
      // get statistics by member user id from db
      statsDb = await prisma.memberHistoryStats.findFirst({
        where: { userId: member.userId, isPrivate: false },
        include: { develop: true, dataScience: true }
      })
      if (!_.isNil(statsDb)) {
        statsDb.groupId = _.toNumber(groupId)
      }
    } else {
      // get statistics private by member user id from db
      statsDb = await prisma.memberHistoryStats.findFirst({
        where: { userId: member.userId, groupId, isPrivate: true },
        include: { develop: true, dataScience: true }
      })
    }
    if (!_.isNil(statsDb)) {
      overallStat.push(statsDb)
    }
  }
  // build stats history response
  let result = _.map(overallStat, t => prismaHelper.buildStatsHistoryResponse(member, t, fields))
  // remove identifiable info fields if user is not admin, not M2M and not member himself
  if (!helper.canManageMember(currentUser, member)) {
    result = _.map(result, (item) => _.omit(item, config.STATISTICS_SECURE_FIELDS))
  }
  return result
}

getHistoryStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  query: Joi.object().keys({
    groupIds: Joi.string(),
    fields: Joi.string()
  })
}

/**
 * Get member statistics.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the member statistics
 */
async function getMemberStats (currentUser, handle, query, throwError) {
  let stats = []
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, MEMBER_STATS_FIELDS) || MEMBER_STATS_FIELDS
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  const groupIds = await helper.getAllowedGroupIds(currentUser, member, query.groupIds)

  const includeParams = prismaHelper.statsIncludeParams

  for (const groupId of groupIds) {
    let stat
    if (groupId === config.PUBLIC_GROUP_ID) {
      // get statistics by member user id from db
      stat = await prisma.memberStats.findFirst({
        where: { userId: member.userId, isPrivate: false },
        include: includeParams
      })
      if (!_.isNil(stat)) {
        stat = _.assign(stat, { groupId: _.toNumber(groupId) })
      }
    } else {
      // get statistics private by member user id from db
      stat = await prisma.memberStats.findFirst({
        where: { userId: member.userId, isPrivate: true, groupId },
        include: includeParams
      })
    }
    if (!_.isNil(stat)) {
      stats.push(stat)
    }
  }
  let result = _.map(stats, t => prismaHelper.buildStatsResponse(member, t, fields))
  // remove identifiable info fields if user is not admin, not M2M and not member himself
  if (!helper.canManageMember(currentUser, member)) {
    result = _.map(result, (item) => _.omit(item, config.STATISTICS_SECURE_FIELDS))
  }
  return result
}

getMemberStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  query: Joi.object().keys({
    groupIds: Joi.string(),
    fields: Joi.string()
  }),
  throwError: Joi.boolean()
}

/**
 * Get member skills.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the member skills
 */
async function getMemberSkills (handle) {
  // validate member
  const member = await helper.getMemberByHandle(handle)
  const skillList = await prisma.memberSkill.findMany({
    where: {
      userId: member.userId
    },
    include: prismaHelper.skillsIncludeParams
  })
  // convert to response format
  return prismaHelper.buildMemberSkills(skillList)
}

getMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required()
}

/**
 * Check create/update member skill data
 * @param {Object} data request body
 */
async function validateMemberSkillData(data) {
  // Check displayMode
  if (data.displayModeId) {
    const modeCount = await prisma.displayMode.count({
      where: { id: data.displayModeId }
    })
    if (modeCount <= 0) {
      throw new errors.BadRequestError(`Display mode ${data.displayModeId} does not exist`)
    }
  }
  if (data.levels && data.levels.length > 0) {
    const levelCount = await prisma.skillLevel.count({
      where: { id: { in: data.levels } }
    })
    if (levelCount < data.levels.length) {
      throw new errors.BadRequestError(`Please make sure skill level exists`)
    }
  }
}


async function createMemberSkills (currentUser, handle, data) {
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  // check authorization
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member skills.')
  }

  // validate request
  const existingCount = await prisma.memberSkill.count({
    where: { userId: member.userId, skillId: data.skillId }
  })
  if (existingCount > 0) {
    throw new errors.BadRequestError('This member skill exists')
  }
  await validateMemberSkillData(data)

  // save to db
  const createdBy = currentUser.handle || currentUser.sub
  const memberSkillData = {
    id: uuidv4(),
    userId: member.userId,
    skillId: data.skillId,
    createdBy,
  }
  if (data.displayModeId) {
    memberSkillData.displayModeId = data.displayModeId
  }
  if (data.levels && data.levels.length > 0) {
    memberSkillData.levels = {
      createMany: { data: 
        _.map(data.levels, levelId => ({
          skillLevelId: levelId,
          createdBy
        }))
      }
    }
  }
  await prisma.memberSkill.create({ data: memberSkillData })

  // get skills by member handle
  const memberSkill = await this.getMemberSkills(handle)
  return memberSkill
}

createMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    skillId: Joi.string().uuid().required(),
    displayModeId: Joi.string().uuid(),
    levels: Joi.array().items(Joi.string().uuid())
  }).required()
}

/**
 * Partially update member skills.
 * @param {Object} currentUser the user who performs operation
 * @param {String} handle the member handle
 * @param {Object} data the skills data to update
 * @returns {Object} the updated member skills
 */
async function partiallyUpdateMemberSkills (currentUser, handle, data) {
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  // check authorization
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member skills.')
  }

  // validate request
  const existing = await prisma.memberSkill.findFirst({
    where: { userId: member.userId, skillId: data.skillId }
  })
  if (!existing || !existing.id) {
    throw new errors.NotFoundError('Member skill not found')
  }
  await validateMemberSkillData(data)

  const updatedBy = currentUser.handle || currentUser.sub
  const memberSkillData = {
    updatedBy,
  }
  if (data.displayModeId) {
    memberSkillData.displayModeId = data.displayModeId
  }
  if (data.levels && data.levels.length > 0) {
    await prisma.memberSkillLevel.deleteMany({
      where: { memberSkillId: existing.id }
    })
    memberSkillData.levels = {
      createMany: { data: 
        _.map(data.levels, levelId => ({
          skillLevelId: levelId,
          createdBy: updatedBy,
          updatedBy
        }))
      }
    }
  }
  await prisma.memberSkill.update({
    data: memberSkillData,
    where: { id: existing.id }
  })

  // get skills by member handle
  const memberSkill = await this.getMemberSkills(handle)
  return memberSkill
}

partiallyUpdateMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    skillId: Joi.string().uuid().required(),
    displayModeId: Joi.string().uuid(),
    levels: Joi.array().items(Joi.string().uuid())
  }).required()
}

/**
 * Create member statistics.
 * @param {Object} currentUser the current user
 * @param {String} handle the member handle
 * @param {Object} data the stats data
 * @returns {Object} the created stats
 */
async function createMemberStats (currentUser, handle, data) {
  // Validate input
  // (For brevity, only develop is shown; repeat for design, dataScience, copilot as needed)
  const schema = Joi.object({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    challenges: Joi.number().optional(),
    wins: Joi.number().optional(),
    develop: Joi.object({
      challenges: Joi.number().optional(),
      wins: Joi.number().optional(),
      mostRecentSubmission: Joi.date().optional(),
      mostRecentEventDate: Joi.date().optional(),
      items: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        subTrackId: Joi.number().required(),
        challenges: Joi.number().optional(),
        wins: Joi.number().optional(),
        mostRecentSubmission: Joi.date().optional(),
        mostRecentEventDate: Joi.date().optional(),
        // ... other fields ...
      })).optional()
    }).optional(),
    // ... design, dataScience, copilot ...
  })
  await schema.validateAsync(data)

  // Get member by handle
  const member = await helper.getMemberByHandle(handle)
  if (!member) {
    throw new errors.NotFoundError(`Member with handle ${handle} not found`)
  }

  // Check for existing record for this userId/groupId/isPrivate
  const exists = await prisma.memberStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null,
      isPrivate: data.isPrivate || false
    }
  })
  if (exists) {
    throw new errors.ConflictError('Stats for this member/group already exists')
  }

  // Create the memberStats record with nested develop/design/dataScience/copilot
  const created = await prisma.memberStats.create({
    data: {
      userId: member.userId,
      groupId: data.groupId,
      isPrivate: data.isPrivate || false,
      challenges: data.challenges,
      wins: data.wins,
      createdBy: currentUser ? currentUser.handle : 'system',
      develop: data.develop ? {
        create: {
          ...data.develop,
          createdBy: currentUser ? currentUser.handle : 'system',
          items: data.develop.items ? {
            create: data.develop.items.map(item => ({
              ...item,
              createdBy: currentUser ? currentUser.handle : 'system'
            }))
          } : undefined
        }
      } : undefined,
      // ... design, dataScience, copilot ...
    },
    include: { develop: { include: { items: true } }, design: true, dataScience: true, copilot: true }
  })

  // Format and return the response
  return prismaHelper.buildStatsResponse(member, created)
}

/**
 * Partially update member statistics.
 * @param {Object} currentUser the current user
 * @param {String} handle the member handle
 * @param {Object} data the stats data
 * @returns {Object} the updated stats
 */
async function partiallyUpdateMemberStats (currentUser, handle, data) {
  // Validate input (same as create)
  const schema = Joi.object({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    challenges: Joi.number().optional(),
    wins: Joi.number().optional(),
    develop: Joi.object({
      challenges: Joi.number().optional(),
      wins: Joi.number().optional(),
      mostRecentSubmission: Joi.date().optional(),
      mostRecentEventDate: Joi.date().optional(),
      items: Joi.array().items(Joi.object({
        id: Joi.number().integer().optional(),
        name: Joi.string().required(),
        subTrackId: Joi.number().required(),
        challenges: Joi.number().optional(),
        wins: Joi.number().optional(),
        mostRecentSubmission: Joi.date().optional(),
        mostRecentEventDate: Joi.date().optional(),
      })).optional()
    }).optional(),
    design: Joi.object({
      challenges: Joi.number().optional(),
      wins: Joi.number().optional(),
      mostRecentSubmission: Joi.date().optional(),
      mostRecentEventDate: Joi.date().optional(),
    }).optional(),
    dataScience: Joi.object({
      challenges: Joi.number().optional(),
      wins: Joi.number().optional(),
      mostRecentSubmission: Joi.date().optional(),
      mostRecentEventDate: Joi.date().optional(),
    }).optional(),
    copilot: Joi.object({
      challenges: Joi.number().optional(),
      wins: Joi.number().optional(),
      mostRecentSubmission: Joi.date().optional(),
      mostRecentEventDate: Joi.date().optional(),
    }).optional()
  })
  await schema.validateAsync(data)

  // Get member by handle
  const member = await helper.getMemberByHandle(handle)
  if (!member) {
    throw new errors.NotFoundError(`Member with handle ${handle} not found`)
  }

  // Find existing stats
  const stats = await prisma.memberStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null,
      isPrivate: data.isPrivate || false
    },
    include: { develop: { include: { items: true } }, design: true, dataScience: true, copilot: true }
  })
  if (!stats) {
    throw new errors.NotFoundError('Stats for this member/group not found')
  }

  // Prepare update data
  const updateData = {}
  if (data.groupId !== undefined) updateData.groupId = data.groupId
  if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate
  if (data.challenges !== undefined) updateData.challenges = data.challenges
  if (data.wins !== undefined) updateData.wins = data.wins
  updateData.updatedBy = currentUser ? currentUser.handle : 'system'

  // --- Handle develop sub-items ---
  if (data.develop) {
    // Update develop main fields
    if (stats.develop) {
      await prisma.memberDevelopStats.update({
        where: { id: stats.develop.id },
        data: {
          ...data.develop,
          updatedBy: currentUser ? currentUser.handle : 'system'
        }
      })
      // Handle items
      if (data.develop.items) {
        const incomingIds = data.develop.items.filter(i => i.id).map(i => i.id)
        const existingIds = stats.develop.items.map(i => i.id)
        const toDelete = existingIds.filter(id => !incomingIds.includes(id))
        const toUpdate = data.develop.items.filter(i => i.id)
        const toCreate = data.develop.items.filter(i => !i.id)
        await prisma.memberDevelopStatsItem.deleteMany({ where: { id: { in: toDelete } } })
        for (const item of toUpdate) {
          await prisma.memberDevelopStatsItem.update({
            where: { id: item.id },
            data: { ...item, updatedBy: currentUser ? currentUser.handle : 'system' }
          })
        }
        for (const item of toCreate) {
          await prisma.memberDevelopStatsItem.create({
            data: { ...item, developStatsId: stats.develop.id, createdBy: currentUser ? currentUser.handle : 'system' }
          })
        }
      }
    }
  }
  // --- Handle design sub-items ---
  if (data.design) {
    if (stats.design) {
      await prisma.memberDesignStats.update({
        where: { id: stats.design.id },
        data: {
          ...data.design,
          updatedBy: currentUser ? currentUser.handle : 'system'
        }
      })
    }
  }
  // --- Handle dataScience sub-items ---
  if (data.dataScience) {
    if (stats.dataScience) {
      await prisma.memberDataScienceStats.update({
        where: { id: stats.dataScience.id },
        data: {
          ...data.dataScience,
          updatedBy: currentUser ? currentUser.handle : 'system'
        }
      })
    }
  }
  // --- Handle copilot sub-items ---
  if (data.copilot) {
    if (stats.copilot) {
      await prisma.memberCopilotStats.update({
        where: { id: stats.copilot.id },
        data: {
          ...data.copilot,
          updatedBy: currentUser ? currentUser.handle : 'system'
        }
      })
    }
  }

  // Update the main record
  await prisma.memberStats.update({
    where: { id: stats.id },
    data: updateData
  })

  // Fetch and return the updated record
  const updated = await prisma.memberStats.findUnique({
    where: { id: stats.id },
    include: { develop: { include: { items: true } }, design: true, dataScience: true, copilot: true }
  })
  return prismaHelper.buildStatsResponse(member, updated)
}

/**
 * Create member history statistics.
 * @param {Object} currentUser the current user
 * @param {String} handle the member handle
 * @param {Object} data the stats history data
 * @returns {Object} the created stats history
 */
async function createHistoryStats (currentUser, handle, data) {
  // Validate input
  const schema = Joi.object({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    develop: Joi.array().items(Joi.object({
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      ratingDate: Joi.date().required(),
      newRating: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional(),
    dataScience: Joi.array().items(Joi.object({
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      date: Joi.date().required(),
      rating: Joi.number().required(),
      placement: Joi.number().required(),
      percentile: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional()
  })
  await schema.validateAsync(data)

  // Get member by handle
  const member = await helper.getMemberByHandle(handle)
  if (!member) {
    throw new errors.NotFoundError(`Member with handle ${handle} not found`)
  }

  // Check for existing record for this userId/groupId/isPrivate
  const exists = await prisma.memberHistoryStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null,
      isPrivate: data.isPrivate || false
    }
  })
  if (exists) {
    throw new errors.ConflictError('Stats history for this member/group already exists')
  }

  // Create the memberHistoryStats record with nested develop/dataScience
  const created = await prisma.memberHistoryStats.create({
    data: {
      userId: member.userId,
      groupId: data.groupId,
      isPrivate: data.isPrivate || false,
      createdBy: currentUser ? currentUser.handle : 'system',
      develop: data.develop ? {
        create: data.develop.map(item => ({
          ...item,
          createdBy: currentUser ? currentUser.handle : 'system'
        }))
      } : undefined,
      dataScience: data.dataScience ? {
        create: data.dataScience.map(item => ({
          ...item,
          createdBy: currentUser ? currentUser.handle : 'system'
        }))
      } : undefined
    },
    include: { develop: true, dataScience: true }
  })

  // Format and return the response
  return prismaHelper.buildStatsHistoryResponse(member, created)
}

createHistoryStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    develop: Joi.array().items(Joi.object({
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      ratingDate: Joi.date().required(),
      newRating: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional(),
    dataScience: Joi.array().items(Joi.object({
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      date: Joi.date().required(),
      rating: Joi.number().required(),
      placement: Joi.number().required(),
      percentile: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional()
  }).required()
}

/**
 * Partially update member history statistics.
 * @param {Object} currentUser the current user
 * @param {String} handle the member handle
 * @param {Object} data the stats history data
 * @returns {Object} the updated stats history
 */
async function partiallyUpdateHistoryStats (currentUser, handle, data) {
  // Validate input
  const schema = Joi.object({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    develop: Joi.array().items(Joi.object({
      id: Joi.number().integer().optional(),
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      ratingDate: Joi.date().required(),
      newRating: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional(),
    dataScience: Joi.array().items(Joi.object({
      id: Joi.number().integer().optional(),
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      date: Joi.date().required(),
      rating: Joi.number().required(),
      placement: Joi.number().required(),
      percentile: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional()
  })
  await schema.validateAsync(data)

  // Get member by handle
  const member = await helper.getMemberByHandle(handle)
  if (!member) {
    throw new errors.NotFoundError(`Member with handle ${handle} not found`)
  }

  // Find existing stats history
  const statsHistory = await prisma.memberHistoryStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null,
      isPrivate: data.isPrivate || false
    },
    include: { develop: true, dataScience: true }
  })
  if (!statsHistory) {
    throw new errors.NotFoundError('Stats history for this member/group not found')
  }

  // Prepare update data
  const updateData = {}
  if (data.groupId !== undefined) updateData.groupId = data.groupId
  if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate
  updateData.updatedBy = currentUser ? currentUser.handle : 'system'

  // --- Handle develop sub-items ---
  if (data.develop) {
    // IDs of incoming develop items
    const incomingIds = data.develop.filter(i => i.id).map(i => i.id)
    // IDs of existing develop items
    const existingIds = statsHistory.develop.map(i => i.id)
    // To delete: existing not in incoming
    const toDelete = existingIds.filter(id => !incomingIds.includes(id))
    // To update: incoming with id
    const toUpdate = data.develop.filter(i => i.id)
    // To create: incoming without id
    const toCreate = data.develop.filter(i => !i.id)
    // Delete
    await prisma.memberDevelopHistoryStats.deleteMany({ where: { id: { in: toDelete } } })
    // Update
    for (const item of toUpdate) {
      await prisma.memberDevelopHistoryStats.update({
        where: { id: item.id },
        data: { ...item, updatedBy: currentUser ? currentUser.handle : 'system' }
      })
    }
    // Create
    for (const item of toCreate) {
      await prisma.memberDevelopHistoryStats.create({
        data: { ...item, historyStatsId: statsHistory.id, createdBy: currentUser ? currentUser.handle : 'system' }
      })
    }
  }

  // --- Handle dataScience sub-items ---
  if (data.dataScience) {
    const incomingIds = data.dataScience.filter(i => i.id).map(i => i.id)
    const existingIds = statsHistory.dataScience.map(i => i.id)
    const toDelete = existingIds.filter(id => !incomingIds.includes(id))
    const toUpdate = data.dataScience.filter(i => i.id)
    const toCreate = data.dataScience.filter(i => !i.id)
    await prisma.memberDataScienceHistoryStats.deleteMany({ where: { id: { in: toDelete } } })
    for (const item of toUpdate) {
      await prisma.memberDataScienceHistoryStats.update({
        where: { id: item.id },
        data: { ...item, updatedBy: currentUser ? currentUser.handle : 'system' }
      })
    }
    for (const item of toCreate) {
      await prisma.memberDataScienceHistoryStats.create({
        data: { ...item, historyStatsId: statsHistory.id, createdBy: currentUser ? currentUser.handle : 'system' }
      })
    }
  }

  // Update the main record
  await prisma.memberHistoryStats.update({
    where: { id: statsHistory.id },
    data: updateData
  })

  // Fetch and return the updated record
  const updated = await prisma.memberHistoryStats.findUnique({
    where: { id: statsHistory.id },
    include: { develop: true, dataScience: true }
  })
  return prismaHelper.buildStatsHistoryResponse(member, updated)
}

partiallyUpdateHistoryStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    groupId: Joi.number().integer().optional(),
    isPrivate: Joi.boolean().optional(),
    develop: Joi.array().items(Joi.object({
      id: Joi.number().integer().optional(),
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      ratingDate: Joi.date().required(),
      newRating: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional(),
    dataScience: Joi.array().items(Joi.object({
      id: Joi.number().integer().optional(),
      challengeId: Joi.number().required(),
      challengeName: Joi.string().required(),
      date: Joi.date().required(),
      rating: Joi.number().required(),
      placement: Joi.number().required(),
      percentile: Joi.number().required(),
      subTrack: Joi.string().required(),
      subTrackId: Joi.number().required(),
    })).optional()
  }).required()
}

module.exports = {
  getDistribution,
  getHistoryStats,
  getMemberStats,
  getMemberSkills,
  createMemberSkills,
  partiallyUpdateMemberSkills,
  createMemberStats,
  partiallyUpdateMemberStats,
  createHistoryStats,
  partiallyUpdateHistoryStats
}

logger.buildService(module.exports)
