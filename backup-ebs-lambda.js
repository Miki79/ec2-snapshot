var AWS = require('aws-sdk');
// Define region for AWS
AWS.config.region = 'eu-west-1';
var ec2 = new AWS.EC2();

var totalVolumes = 0;
var totalSnapshots = 0;

exports.createSnapshots = function (event, context) {

    var params = {
        Filters: [
            {
                "Name": "tag-key",
                "Values": ["Backup"]
            }
        ]
    };

    ec2.describeVolumes(params, function (err, data) {
        totalVolumes = data.Volumes.length;
        for (var i in data.Volumes) {
            if (data.Volumes.hasOwnProperty(i)) {
                var volumeInfo = getVolumeInfo(data.Volumes[i]);
                checkVolumeSnapshot(volumeInfo, context);
            }
        }
    });
};

function getVolumeInfo(volume) {

    var volumeId = volume.VolumeId;
    var name = volumeId;
    var instanceId = '';
    var type = 1;
    for (var i in volume.Attachments) {
        if (volume.Attachments.hasOwnProperty(i)) {
            instanceId = volume.Attachments[i].InstanceId;
        }
    }

    for (var m in volume.Tags) {
        if (volume.Tags.hasOwnProperty(m)) {
            if (volume.Tags[m].Key == 'Name') {
                name = volume.Tags[m].Value;
            } else if (volume.Tags[m].Key == 'Backup') {
                type = volume.Tags[m].Value;
            }
        }
    }
    return {'name': name, 'instance': instanceId, 'volumeId': volumeId, 'type': type};
}

function checkVolumeSnapshot(volume, context) {
    var params = {
        Filters: [
            {
                "Name": "tag-key",
                "Values": ["VolumeId"]
            },
            {
                "Name": "tag-value",
                "Values": [volume.volumeId]
            }
        ]
    };
    ec2.describeSnapshots(params, function (err, data) {
        if (err) {
            console.error(err, err.stack);
        } else {
            var types = volume.type.split(",");
            var type = 1;
            loopTypes:
                for (var a in types) {

                    if (types.hasOwnProperty(a)) {
                        type = types[a];
                    }

                    if (data.Snapshots.length === 0) {
                        totalSnapshots++;
                        console.log('Create backup (1) for ' + volume.volumeId + ' (' + volume.name + ') ' + type);
                        createSnapshot(volume, type, context);
                        break;
                    } else {
                        for (var i in data.Snapshots) {
                            if (data.Snapshots.hasOwnProperty(i)) {
                                var purgeAfter = '', typeSnapshot = 0;
                                for (var m in data.Snapshots[i].Tags) {
                                    if (data.Snapshots[i].Tags.hasOwnProperty(m)) {
                                        if (data.Snapshots[i].Tags[m].Key == 'PurgeAfter') {
                                            purgeAfter = data.Snapshots[i].Tags[m].Value;
                                        } else if (data.Snapshots[i].Tags[m].Key == 'Type') {
                                            typeSnapshot = data.Snapshots[i].Tags[m].Value;
                                        }
                                    }
                                }
                                if (type === '1' && purgeAfter == getDateString(type)) {
                                    console.log('Backup already exists (1) for ' + volume.volumeId + ' (' + volume.name + ') ' + type);
                                    continue loopTypes;
                                } else if (type !== '1' && type == typeSnapshot && purgeAfter !== getDateString('0')) {
                                    console.log('Backup already exists (2) for ' + volume.volumeId + ' (' + volume.name + ') ' + type);
                                    continue loopTypes;
                                }
                            }
                        }
                        totalSnapshots++;
                        console.log('Create backup (2) for ' + volume.volumeId + ' (' + volume.name + ') ' + type);
                        createSnapshot(volume, type, context);
                        break;
                    }
                }
        }
        totalVolumes--;
        if (totalVolumes === 0 && totalSnapshots === 0) {
            context.succeed('No Backups Required');
        }
    });


}

function createSnapshot(volume, type, context) {
    var par = {
        VolumeId: volume.volumeId,
        Description: getNameFromDate(type) + ' backup of ' + volume.name + ' (' + volume.volumeId + ')'
    };
    ec2.createSnapshot(par, function (err, data) {
            if (err) {
                totalSnapshots--;
                console.error(err, err.stack);
            } else {
                createTags(data.SnapshotId, volume, type, context);
            }
        }
    );
}

function createTags(snapshotId, volume, type, context) {
    var tagData = {
        Resources: [
            snapshotId
        ],
        Tags: [
            {
                Key: 'Name',
                Value: volume.name + ' (' + getNameFromDate(type) + ')'
            },
            {
                Key: 'PurgeAfter',
                Value: getDateString(type)
            },
            {
                Key: 'VolumeId',
                Value: volume.volumeId
            },
            {
                Key: 'Type',
                Value: type
            }
        ]
    };
    ec2.createTags(tagData, function (err, data) {

        if (err) {
            console.error(err, err.stack);
        } else {
            console.log('Snapshot for ' + volume.name + ' (' + getNameFromDate(type) + ')');
        }
        totalSnapshots--;
        if (totalSnapshots === 0) {
            context.succeed('Backups completed');
        }
    });
}

function getDateString(type) {
    // Build a YYYYMMDD formatted current date string
    var date = new Date();
    date.setDate(date.getDate() + parseInt(type, 10));

    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return year + month + day;
}

function getNameFromDate(day) {
    switch (day) {
        case '1':
            return 'Daily';
        case '7':
            return 'Weekly';
        case '30':
        case '31':
            return 'Monthly';
        default:
            return day;
    }
}
