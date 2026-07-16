const User = require('../models/users')
const moment = require('moment')

function countWorkingDays(startDate, endDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    const diff = end.getTime() - start.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  
}

exports.getReportAttlogs = async (req, res) => {
    const startDate = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
    const endDate = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
    const workingDays = countWorkingDays(startDate, endDate)
    const today = moment().set('hour', 23).set('minute', 59).set('second', 59).set('millisecond', 999).toDate()
    try {
        const employees = await User.aggregate([
            {$match: {$and: [{isAdmin: false}, {isActive: true}]}},
            {$lookup: {
                from:'shops',
                foreignField: '_id',
                localField: 'employmentData.shopId',
                as: 'shops'
            }},
            {$unwind: '$shops'},
            {$project: {
                pin: 1,
                name: 1,
                shop: '$shops.name',
                payroll: '$payroll.gajiPokok',
                startAt: '$employmentData.tanggalBergabung'
            }},
            {
                $addFields: {
                    serviceMonthsTotal: {
                        $cond: [
                            {
                                $ne: [
                                    '$startAt',
                                    null
                                ]
                            },
                            {
                                $dateDiff: {
                                    startDate: '$startAt',
                                    endDate: today,
                                    unit: 'month'
                                }
                            },
                            null
                        ]
                    }
                }
            },
            {
                $addFields: {
                    serviceYears: {
                        $cond: [
                            {
                                $ne: [
                                    '$serviceMonthsTotal',
                                    null
                                ]
                            },
                            {
                                $floor: {
                                    $divide: [
                                        '$serviceMonthsTotal',
                                        12
                                    ]
                                }
                            },
                            null
                        ]
                    },

                    serviceMonths: {
                        $cond: [
                            {
                                $ne: [
                                    '$serviceMonthsTotal',
                                    null
                                ]
                            },
                            {
                                $mod: [
                                    '$serviceMonthsTotal',
                                    12
                                ]
                            },
                            null
                        ]
                    },

                    servicePeriod: {
                        $cond: [
                            {
                                $eq: [
                                    '$serviceMonthsTotal',
                                    null
                                ]
                            },
                            '-',
                            {
                                $concat: [
                                    {
                                        $toString: {
                                            $floor: {
                                                $divide: [
                                                    '$serviceMonthsTotal',
                                                    12
                                                ]
                                            }
                                        }
                                    },
                                    ' tahun ',
                                    {
                                        $toString: {
                                            $mod: [
                                                '$serviceMonthsTotal',
                                                12
                                            ]
                                        }
                                    },
                                    ' bulan'
                                ]
                            }
                        ]
                    }
                }
            },
            {$lookup: {
                from: 'attlogs',
                let: {userPin: '$pin'},
                pipeline: [
                    {$match: {
                        $expr: {
                            $and: [
                                {$eq: ['$userPin', '$$userPin']},
                                {$gte: ['$scanDate', startDate]},
                                {$lt: ['$scanDate', endDate]}
                            ]
                        }
                    }},
                    {$sort: {scanDate: 1}}
                ],
                as: 'attlogs'
            }},
            {$addFields: {
                present: {
                    $size: {
                        $filter: {
                            input: '$attlogs',
                            as: 'log',
                            cond: {
                                $and: [
                                    {$ne: ['$$log.scanIn', null]},
                                    {$not: {
                                        $in: [{$toUpper: {$ifNull: ['$$log.information','']}}, ['IZIN', 'SAKIT', 'LIBUR', 'TK', 'TANPA KETERANGNA']]
                                    }}
                                ]
                            }
                        }
                    }
                },
                permission: {
                    $size: {
                        $filter: {
                            input: '$attlogs',
                            as: 'log',
                            cond: {
                            $eq: [
                                {
                                    $toUpper: {
                                        $ifNull: [
                                        '$$log.information',
                                        ''
                                        ]
                                    }
                                },
                                'IZIN'
                            ]
                            }
                        }
                    }
                },
                sick: {
                    $size: {
                        $filter: {
                            input: '$attlogs',
                            as: 'log',
                            cond: {
                                $eq: [
                                    {
                                    $toUpper: {
                                        $ifNull: [
                                        '$$log.information',
                                        ''
                                        ]
                                    }
                                    },
                                    'SAKIT'
                                ]
                            }
                        }
                    }
                },
                holiday: {
                    $size: {
                        $filter: {
                            input: '$attlogs',
                            as: 'log',
                            cond: {
                                $eq: [
                                    {
                                        $toUpper: {
                                            $ifNull: [
                                            '$$log.information',
                                            ''
                                            ]
                                        }
                                    },
                                    'LIBUR'
                                ]
                            }
                        }
                    }
                },
                withoutInformationFromLog: {
                    $size: {
                        $filter: {
                            input: '$attlogs',
                            as: 'log',
                            cond: {
                                $in: [
                                    {
                                        $toUpper: {
                                            $ifNull: [
                                                '$$log.information',
                                                ''
                                            ]
                                        }
                                    },
                                    [
                                        'TK',
                                        'TANPA KETERANGAN'
                                    ]
                                ]
                            }
                        }
                    }
                }
            }},
            {$addFields: {
                withoutInformation: {
                    $max: [
                        {
                            $subtract: [
                            workingDays,
                                {
                                    $add: [
                                        '$present',
                                        '$permission',
                                        '$sick',
                                        '$holiday'
                                    ]
                                }
                            ]
                        },
                    0
                    ]
                }
            }},
            {
                $addFields: {
                    attendanceRate: {
                        $cond: [
                            {
                                $gt: [
                                    {
                                        $subtract: [
                                            workingDays,
                                            '$holiday'
                                        ]
                                    },
                                    0
                                ]
                            },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            '$present',
                                            {
                                                $subtract: [
                                                    workingDays,
                                                    '$holiday'
                                                ]
                                            }
                                        ]
                                    },
                                    100
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            {$addFields: {
                attendanceStatus: {
                    $switch: {
                        branches: [
                            {
                                case: {
                                    $gte: [
                                    '$attendanceRate',
                                    95
                                    ]
                                },
                                then: 'BAGUS'
                            },
                            {
                                case: {
                                    $gte: [
                                    '$attendanceRate',
                                    85
                                    ]
                                },
                                then: 'BAIK'
                            },
                            {
                                case: {
                                    $gte: [
                                    '$attendanceRate',
                                    75
                                    ]
                                },
                                then: 'CUKUP'
                            }
                        ],
                        default: 'KURANG'
                    }
                }
            }},
            {$addFields: {
                workingDays: workingDays
            }}, 
            {$project: {
                name: 1,
                shop: 1,
                payroll: 1,
                serviceYears: 1,
                serviceMonths: 1,
                servicePeriod: 1,
                workingDays: 1,
                present: 1,
                permission: 1,
                sick: 1,
                holiday: 1,
                withoutInformationFromLog: 1,
                withoutInformation: 1,
                attendanceRate: 1,
                attendanceStatus: 1
            }}
        ])

        const totalEmployees = employees.length
        const totals = employees.reduce(
            (result, employee) => {
                result.present += employee.present
                result.permission += employee.permission
                result.sick += employee.sick
                result.withoutInformation +=
                employee.withoutInformation
                result.holiday += employee.holiday
                return result
            },
            {
                present: 0,
                permission: 0,
                sick: 0,
                withoutInformation: 0,
                holiday: 0
            }
        )
        const totalPossibleAttendance = totalEmployees * workingDays
        const attendanceRate = totalPossibleAttendance > 0 ? Number((totals.present /totalPossibleAttendance * 100).toFixed(2)): 0
        const turnover = await User.countDocuments({
            'employmentData.tanggalKeluar': { $gte: startDate, $lt: endDate}
        })

        return res.status(200).json({
            status: true,
            period: {
                startDate,
                endDate,
                workingDays
            },
            summary: {
                totalEmployees,
                attendanceRate,
                totalPresent: totals.present,
                withoutInformation: totals.withoutInformation,
                permission: totals.permission,
                sick: totals.sick,
                holiday: totals.holiday,
                turnover
            },
            data: employees
        })
    } catch (error) {
        console.log(error)
    }
}