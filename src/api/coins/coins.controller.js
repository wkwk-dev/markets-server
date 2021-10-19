const { utcDate } = require('../../utils')
const Coin = require('../../db/models/Coin')
const Platform = require('../../db/models/Platform')
const serializer = require('./coins.serializer')

exports.index = async ({ query, currencyRate }, res) => {
  const options = {
    where: {},
    order: [Coin.literal('market_data->\'market_cap\' DESC')]
  }

  let fields = []
  if (query.fields) {
    fields = query.fields.split(',')
  }
  if (fields.includes('platforms')) {
    options.include = Platform
  }
  if (query.limit) {
    options.limit = query.limit
  }
  if (query.uids) {
    options.where.uid = query.uids.split(',')
  }

  const coins = await Coin.findAll(options)

  res.send(serializer.serializeList(coins, fields, currencyRate))
}

exports.show = async (req, res, next) => {
  const { language = 'en' } = req.query
  const coin = await Coin.getCoinInfo(req.params.id)

  if (coin) {
    res.send(serializer.serializeShow(coin, language, req.currencyRate))
  } else {
    res.status(404)
    res.send({
      error: 'Coin not found'
    })
  }
}

exports.transactions = async (req, res) => {
  const { id } = req.params
  const { interval } = req.query

  let window
  let dateFrom

  switch (interval) {
    case '1d':
      window = '1h'
      dateFrom = utcDate('yyyy-MM-dd HH:00:00', { days: -1 })
      break
    case '7d':
      window = '4h'
      dateFrom = utcDate('yyyy-MM-dd HH:00:00', { days: -7 })
      break
    default:
      window = '1d'
      dateFrom = utcDate('yyyy-MM-dd HH:00:00', { days: -30 })
      break
  }

  const transactions = await Coin.getTransactions(id, window, dateFrom)

  res.send(transactions)
}

exports.addresses = async (req, res) => {
  const { id } = req.params
  const { interval } = req.query

  let window
  switch (interval) {
    case '1d':
      window = '1h'
      break
    case '7d':
      window = '4h'
      break
    default:
      window = '1d'
      break
  }

  const addresses = await Coin.getAddresses(id, window)

  res.send(addresses)
}

exports.addressHolders = async (req, res) => {
  const { id } = req.params
  const { limit } = req.query
  const coinHolders = await Coin.getCoinHolders(id, limit)

  res.send(coinHolders)
}

exports.addressRanks = async (req, res) => {
  const { id } = req.params
  const { limit } = req.query
  const addressRanks = await Coin.getAddressRanks(id, limit)

  res.send(addressRanks)
}