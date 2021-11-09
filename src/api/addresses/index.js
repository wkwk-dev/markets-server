const express = require('express')
const controller = require('./addresses.controller')
const { validateAddresses, validateHolders, validateRanks } = require('./addresses.validator')

const router = express.Router()

/**
 * @api {get} /v1/addresses List addresses
 * @apiDescription Get a list of addresses
 * @apiVersion 1.0.0
 * @apiGroup Address
 *
 * @apiParam  {String=bitcoin,ethereum,...}   coin_uid        Coin's uid
 * @apiParam  {String=1d,7d,30d}              [interval]      Date interval
 *
 * @apiSuccess  {String}    date       date
 * @apiSuccess  {String}    count      count
 * @apiSuccess  {Date}      volume     volume
 *
 * @apiSuccessExample {json} Success-Response:
 *  HTTP/1.1 200 OK
 *  [{
 *    "date": "2021-10-04T00:00:00.000Z",
 *    "count": "1679",
 *    "volume": "5345234.554566495"
 *  }]
 *
 * @apiError (Bad Request 400)  ValidationError   Some parameters may contain invalid values
 */
router.get('/', validateAddresses, controller.index)

/**
 * @api {get} /v1/addresses/holders List coin holders
 * @apiDescription Get a list of coin holders
 * @apiVersion 1.0.0
 * @apiGroup Address
 *
 * @apiParam  {String=bitcoin,ethereum,...}   coin_uid        Coin's uid
 *
 * @apiError (Bad Request 400)  ValidationError   Some parameters may contain invalid values
 */
router.get('/holders', validateHolders, controller.holders)

/**
 * @api {get} /v1/addresses/ranks List address ranks
 * @apiDescription Get a list of address ranks
 * @apiVersion 1.0.0
 * @apiGroup Address
 *
 * @apiParam  {String=bitcoin,ethereum,...}   coin_uid        Coin's uid
 *
 * @apiError (Bad Request 400)  ValidationError   Some parameters may contain invalid values
 */
router.get('/ranks', validateRanks, controller.ranks)

module.exports = router