const defillama = require('../providers/defillama')
const logger = require('../config/logger')
const Syncer = require('./Syncer')
const DefiProtocol = require('../db/models/DefiProtocol')
const DefiProtocolTvl = require('../db/models/DefiProtocolTvl')
const Coin = require('../db/models/Coin')
const utils = require('../utils')

class DefiProtocolSyncer extends Syncer {

  async start() {
    await this.syncHistorical()
    await this.syncLatest()
  }

  async syncHistorical(protocols) {
    if (protocols) {
      return this.syncHistoricalTvls(await DefiProtocol.getIds(protocols))
    }

    if (await DefiProtocolTvl.exists()) {
      return
    }

    if (!await DefiProtocol.exists()) {
      try {
        await this.syncProtocols(await this.fetchProtocols())
      } catch (e) {
        console.error(e)
      }
    }

    await this.syncHistoricalTvls(await DefiProtocol.getIds())
  }

  async syncHistoricalTvls(protocols) {
    await DefiProtocolTvl.delete(protocols.map(p => p.id))

    for (let i = 0; i < protocols.length; i += 1) {
      try {
        await this.syncProtocolTvls(protocols[i])
        await utils.sleep(300)
      } catch (e) {
        console.error(e)
      }
    }
  }

  async syncProtocolTvls(defiProtocol) {
    const protocol = await defillama.getProtocol(defiProtocol.defillama_id)
    const tvls = {}

    for (let i = 0; i < protocol.tvl.length; i += 1) {
      const item = protocol.tvl[i]
      const date = new Date(item.date * 1000).setMinutes(0, 0, 0)

      tvls[date] = {
        date,
        defi_protocol_id: defiProtocol.id,
        tvl: item.totalLiquidityUSD,
        chain_tvls: {}
      }
    }

    Object.entries(protocol.chainTvls).forEach(([chain, data]) => {
      for (let i = 0; i < data.tvl.length; i += 1) {
        const item = data.tvl[i]
        const date = new Date(item.date * 1000).setMinutes(0, 0, 0)
        const tvl = tvls[date]
        if (tvl) {
          tvl.chain_tvls[chain] = item.totalLiquidityUSD
        }
      }
    })

    const records = await DefiProtocolTvl.bulkCreate(Object.values(tvls), { ignoreDuplicates: true })
    console.log(`Inserted ${records.length} tvl record for ${defiProtocol.defillama_id}`)
  }

  async syncLatest() {
    this.cron('1h', this.syncDailyStats)
    this.cron('4h', this.syncWeeklyStats)
    this.cron('1d', this.syncMonthlyStats)
  }

  async syncDailyStats({ dateTo }) {
    try {
      const protocols = await this.fetchProtocols()
      const monthlyTvlMap = await this.getMonthlyTvlMap(dateTo)
      await this.syncProtocols(protocols, monthlyTvlMap)
      await this.syncLatestTvls(protocols, dateTo)
    } catch (e) {
      console.error(e)
    }
  }

  async syncWeeklyStats({ dateFrom, dateTo }) {
    await DefiProtocolTvl.deleteExpired(dateFrom, dateTo)
  }

  async syncMonthlyStats({ dateFrom, dateTo }) {
    await DefiProtocolTvl.deleteExpired(dateFrom, dateTo)
  }

  async syncLatestTvls(protocols, dateTo) {
    const ids = {}
    const tvls = []
    const defiProtocols = await DefiProtocol.getIds()

    for (let i = 0; i < defiProtocols.length; i += 1) {
      const coin = defiProtocols[i]
      ids[coin.defillama_id] = coin.id
    }

    for (let i = 0; i < protocols.length; i += 1) {
      const protocol = protocols[i]
      const defiCoinId = ids[protocol.slug]

      if (!defiCoinId) {
        continue
      }

      logger.info(`Syncing tvl for slug: ${protocol.slug}; gecko_id: ${protocol.gecko_id}`)

      tvls.push({
        defi_protocol_id: defiCoinId,
        date: dateTo,
        tvl: protocol.tvl,
        chain_tvls: protocol.chainTvls
      })
    }

    await DefiProtocolTvl.bulkCreate(tvls, { ignoreDuplicates: true })
  }

  async syncProtocols(protocols, monthlyTvlMap = {}) {
    const coins = await Coin.findAll({
      attributes: ['id', 'coingecko_id'],
      where: {
        uid: protocols.map(item => item.gecko_id).filter(id => id)
      }
    })

    const ids = coins.reduce((memo, coin) => ({ ...memo, [coin.coingecko_id]: coin.id }), {})

    for (let i = 0; i < protocols.length; i += 1) {
      const protocol = protocols[i]
      const coinId = ids[protocol.gecko_id]
      const monthlyTvl = monthlyTvlMap[protocol.slug]

      const values = {
        name: protocol.name,
        logo: protocol.logo,
        coin_id: coinId,
        defillama_id: protocol.slug,
        coingecko_id: protocol.gecko_id,
        tvl: protocol.tvl,
        tvl_rank: i + 1,
        tvl_change: {
          change_1h: protocol.change_1h,
          change_1d: protocol.change_1d,
          change_7d: protocol.change_7d,
          change_30d: utils.percentageBetweenNumber(monthlyTvl, protocol.tvl)
        },
        chain_tvls: protocol.chainTvls,
        chains: protocol.chains
      }

      logger.info(`Upserting DefiProtocol; Defillama: ${protocol.slug}; Coingecko: ${protocol.gecko_id}`)
      await DefiProtocol.upsert(values)
    }
  }

  async fetchProtocols() {
    let protocols = []
    try {
      protocols = await defillama.getProtocols()
      logger.info(`Fetched new protocols ${protocols.length}`)
    } catch (e) {
      logger.error(`Error syncing protocols ${e.message}`)
    }

    return protocols
  }

  async getMonthlyTvlMap(dateTo) {
    const tvls = await DefiProtocolTvl.getLastMonthTvls(dateTo)

    return tvls.reduce((memo, item) => ({
      ...memo,
      [item.defillama_id]: item.tvl
    }), {})
  }
}

module.exports = DefiProtocolSyncer
