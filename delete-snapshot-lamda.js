var AWS = require('aws-sdk');
// Define AWS region
AWS.config.region = 'eu-west-1';
var ec2 = new AWS.EC2();

var totalSnapshot = 0;

exports.purgeSnapshots = function (event, context) {

    var date = getDatePurgeDate();
    var params = {
        Filters: [
            {
                "Name": "tag-key",
                "Values": ["PurgeAfter"]
            }
        ]
    };

    ec2.describeSnapshots(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            if (data.Snapshots.length > 0) {
                for (var i in data.Snapshots) {
                    if (data.Snapshots.hasOwnProperty(i)) {
                        for (var m in data.Snapshots[i].Tags) {
                            if (data.Snapshots[i].Tags.hasOwnProperty(m)) {
                                if (data.Snapshots[i].Tags[m].Key == 'PurgeAfter') {
                                    console.info(data.Snapshots[i].Tags[m].Value);
                                }
                                if (data.Snapshots[i].Tags[m].Key == 'PurgeAfter' && data.Snapshots[i].Tags[m].Value <= date) {
                                    totalSnapshot++;
                                    deleteSnapshot(data.Snapshots[i].SnapshotId, context);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (totalSnapshot === 0) {
            context.succeed('No purge');
        }
    });
};

function deleteSnapshot(snapshotId, context) {
    var params = {
        SnapshotId: snapshotId
    };
    ec2.deleteSnapshot(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        totalSnapshot--;
        if (totalSnapshot <= 0) {
            context.succeed('Snapshot deleted');
        }
    });
}

function getDatePurgeDate() {
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return year + month + day;
}
