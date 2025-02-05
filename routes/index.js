const express = require('express');
const md5 = require('md5');
const router = express.Router();
const {check, validationResult, param} = require('express-validator');
const showdown = require('showdown');
const converter = new showdown.Converter();
const mail = require('@sendgrid/mail');
const axios = require('axios');
const qr = require('qrcode');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const BASE_URL = process.env.BASE_URL;
const FROM_EMAIL = process.env.FROM_EMAIL;

mail.setApiKey(SENDGRID_API_KEY);

router.get('/', (req, res) => {
    res.status(200).send({
        status: 'Health check succeeded.'
    });
});

/**
 * @api {post} /sendMail
 * @apiVersion 0.2.0
 * @apiName SendMail
 * @apiGroup Send Mail
 *
 * @apiParam {String} eventName Name of the event
 * @apiParam {String} mailSubject Subject of the mail to be sent
 * @apiParam {String} mailBody Body of the mail to be sent
 * @apiParam {String="absent", "present", "both"} sendTo Target audience
 * @apiParam {Boolean} isMarkdown Whether the mail body is formatted with markdown
 * @apiParam {Number} day The event day
 * @apiParam {String} key The key to search hades backend for. Can be empty
 * @apiParam {String} value The key to search hades backend. Can be empty
 * @apiParam {Boolean} sendQR Whether QR should be send as an attachment or not
 *
 * @apiHeader {String} x-access-token A token to authorize use of this endpoint
 *
 * @apiSuccess {String} status Response status
 * @apiSuccess {Object} err Errors, if any
 *
 * @apiSuccessExample Success-Response:
 *      HTTP/1.1 200 OK
 *      {
 *          "status": "success",
 *          "err": null
 *      }
 *
 * @apiError ValidationFailed The request body validation check failed
 * @apiErrorExample Validation-Error-Response:
 *      HTTP/1.1 422 Unprocessable Entity
 *      {
 *          "err": [
 *              {
 *                  "msg": "Invalid value",
 *                  "param": "mailSubject",
 *                  "location": "body"
 *              },
 *              {
 *                  "msg": "Invalid value",
 *                  "param": "mailBody",
 *                  "location": "body"
 *              }
 *          ]
 *      }
 *
 * @apiError ParticipantsEmpty The participants list is empty
 * @apiErrorExample Participants-Error-Response:
 *      HTTP/1.1 500 Internal Server Error
 *      {
 *          "status": "EmptyParticipants",
 *          "err": "Participant list is empty"
 *      }
 */
router.post('/sendMail', [
    check('eventName').not().isEmpty(),
    check('mailSubject').not().isEmpty(),
    check('mailBody').not().isEmpty().trim().escape(),
    check('sendTo').not().isEmpty().isIn(['absent', 'present', 'both']),
    check('isMarkdown').not().isEmpty().isBoolean(),
    check('sendQR').not().isEmpty().isBoolean(),
    check('day').not().isEmpty().isInt(),
    check('key').trim().escape(),
    check('value').trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    const accessToken = req.header('x-access-token');
    console.log(req.body);
    if (!errors.isEmpty()) {
        // console.log(errors);
        return res.status(422).send({
            status: "ValidationFailed",
            err: errors.array()
        });
    } else {
        const {eventName, mailSubject, mailBody, sendTo, isMarkdown, day, specific, key, value, sendQR} = req.body;
        const instance = axios.create({
            baseURL: BASE_URL,
            timeout: 1000,
            headers: {'Authorization': accessToken}
        });

        let response;
        switch (sendTo) {
            case 'absent':
                try {
                    const data = {
                        event: eventName,
                        day: day,
                        query: {
                            key: key,
                            value: value,
                            specific: specific
                        }
                    };
                    // console.log(data);
                    response = await instance.post('simple-projection/project-absent', data);
                } catch (e) {
                    // console.log(e);
                    return res.status(500).send({
                        status: "Failed",
                        err: e
                    });
                }
                break;
            case 'present':
                try {
                    response = await instance.post('simple-projection/project-present', {
                        event: eventName,
                        day: day,
                        query: {
                            key: key,
                            value: value,
                            specific: specific
                        }
                    });
                } catch (e) {
                    // console.log(e);
                    return res.status(500).send({
                        status: "Failed",
                        err: e
                    });
                }
                break;
            case 'both':
                try {
                    const data = {
                        event: eventName,
                        day: day,
                        query: {
                            key: key,
                            value: value,
                            specific: specific
                        }
                    };
                    // console.log(data);
                    response = await instance.post('simple-projection/project-all', data);
                } catch (e) {
                    // console.log(e);
                    return res.status(500).send({
                        status: "Failed",
                        err: e
                    });
                }
                break;
        }

        if (typeof response === undefined || response.data.rs.length === 0) {
            return res.status(500).send({
                status: 'EmptyParticipants',
                err: 'Participant list is empty'
            });
        } else {
            res.status(200).send({
                status: 'success',
                err: null,
                participants: response.data.rs.length
            });
        }


        for (const participant of response.data.rs) {
            let code;
            try {
                code = await qr.toDataURL(participant.email);
            } catch (e) {
                console.log(e);
            }

            const msg = {
                to: participant.email,
                from: FROM_EMAIL,
                subject: mailSubject,
                html: isMarkdown ? converter.makeHtml(mailBody) : mailBody,
                attachments: sendQR ? [
                    {
                        content: code.replace(/^data:image\/(png|jpg);base64,/, ""),
                        filename: 'qrcode.png',
                        type: 'image/png',
                        disposition: 'attachment',
                    }
                ] : null
            };
            try {
                await mail.send(msg);
            } catch (e) {
                console.log(e);
            }
        }
    }
});

/**
 * @api {post} /sendMail/:customEmail
 * @apiVersion 0.2.0
 * @apiName SendCustomMail
 * @apiGroup Send Mail
 *
 * @apiParam {String} eventName Name of the event
 * @apiParam {String} mailSubject Subject of the mail to be sent
 * @apiParam {String} mailBody Body of the mail to be sent
 * @apiParam {Boolean} isMarkdown Whether the mail body is formatted with markdown
 * @apiParam {String} customEmail The email of the person to send a mail to
 * @apiParam {Boolean} sendQR Whether QR should be send as an attachment or not
 *
 * @apiHeader {String} x-access-token A token to authorize use of this endpoint
 *
 * @apiSuccess {String} status Response status
 * @apiSuccess {Object} err Errors, if any
 *
 * @apiSuccessExample Success-Response:
 *      HTTP/1.1 200 OK
 *      {
 *          "status": "success",
 *          "err": null
 *      }
 *
 * @apiError ValidationFailed The request body validation check failed
 * @apiErrorExample Validation-Error-Response:
 *      HTTP/1.1 422 Unprocessable Entity
 *      {
 *          "err": [
 *              {
 *                  "msg": "Invalid value",
 *                  "param": "mailSubject",
 *                  "location": "body"
 *              },
 *              {
 *                  "msg": "Invalid value",
 *                  "param": "mailBody",
 *                  "location": "body"
 *              }
 *          ]
 *      }
 *
 * @apiError MailNotSent The mail was not sent due to an error
 * @apiErrorExample Mail-Error-Response:
 *      HTTP/1.1 500 Internal Server Error
 *      {
 *          "status": "MailNotSent",
 *          "err": {
 *              "message": "Bad Request",
 *              "code": 400,
 *              "response": {
 *                  "headers": {
 *                      "server": "nginx",
 *                      "date": "Tue, 13 Aug 2019 05:32:53 GMT",
 *                      "content-type": "application/json",
 *                      "content-length": "209",
 *                      "connection": "close",
 *                      "access-control-allow-origin": "https://sendgrid.api-docs.io",
 *                      "access-control-allow-methods": "POST",
 *                      "access-control-allow-headers": "Authorization, Content-Type, On-behalf-of, x-sg-elas-acl",
 *                      "access-control-max-age": "600",
 *                      "x-no-cors-reason": "https://sendgrid.com/docs/Classroom/Basics/API/cors.html"
 *                  },
 *                  "body": {
 *                      "errors": [
 *                          {
 *                             "message": "The attachment content must be base64 encoded.",
 *                             "field": "attachments.0.content",
 *                             "help": "http://sendgrid.com/docs/API_Reference/Web_API_v3/Mail/errors.html#message.attachments.content"
 *                          }
 *                      ]
 *                  }
 *              }
 *          }
 *      }
 */
router.post('/sendMail/:customEmail', [
    check('eventName').not().isEmpty(),
    check('mailSubject').not().isEmpty(),
    check('mailBody').not().isEmpty().trim().escape(),
    check('isMarkdown').not().isEmpty().isBoolean(),
    check('sendQR').not().isEmpty().isBoolean(),
    param('customEmail').not().isEmpty().isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors);
        return res.status(422).send({
            status: 'ValidationFailed',
            err: errors.array()
        });
    } else {
        const {mailSubject, mailBody, isMarkdown, eventName, sendQR} = req.body;
        const {customEmail} = req.params;
        let code;
        try {
            code = await qr.toDataURL(customEmail);
        } catch (e) {
            console.log(e);
        }

        const msg = {
            to: customEmail,
            from: FROM_EMAIL,
            subject: mailSubject,
            html: isMarkdown ? converter.makeHtml(mailBody) : mailBody,
            attachments: sendQR ? [
                {
                    content: code.replace(/^data:image\/(png|jpg);base64,/, ""),
                    filename: 'qrcode.png',
                    type: 'image/png',
                    disposition: 'attachment',
                }
            ] : null
        };
        try {
            await mail.send(msg);
            return res.status(200).send({
                status: "success",
                err: null
            })
        } catch (e) {
            console.log(e);
            return res.status(500).send({
                status: "MailNotSent",
                err: e
            })
        }
    }
});

module.exports = router;