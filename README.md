# Create snapshot of EC2 volumes using Cloudwatch and Lambda

### Setup volumes
Add a tag called "Backup" to the [volume](https://eu-west-1.console.aws.amazon.com/ec2/v2/home?#Volumes:sort=Name) you want to backup with the value how often you want to backup that volume. For example, if you want to backup every 2 days, put the value "2". You can put multiple values comma separated, so if you want to create a backup daily, weekly and monthly insert the value "1,7,30"

### Setup Role
Create a [role](https://console.aws.amazon.com/iam/home) for Lambda with "AWSLambdaBasicExecutionRole" profile and add the policy
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "LambdaEBSBackup",
            "Effect": "Allow",
            "Action": [
                "ec2:CreateSnapshot",
                "ec2:CreateTags",
                "ec2:DeleteSnapshot",
                "ec2:DescribeSnapshots",
                "ec2:DescribeTags",
                "ec2:DescribeVolumes"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```
### Snapshot function
Create a new function in lamda and copy the content of the file "[backup-ebs-lambda.js](/Miki79/ec2-volume-backup-lambda/blob/master/backup-ebs-lambda.js)" in it. Be sure to select the role you created in the previous step

### Delete snapshot function
Create a new function in lambda and copy the content of the file "[delete-snapshot-lambda.js](/Miki79/ec2-volume-backup-lambda/blob/master/delete-snapshot-lambda.js)" in it (apply the same role)

### Cronjob
Create a new [rule](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/WhatIsCloudWatchEvents.html) in "events" in "cloudwatch"
As "select event source" select "schedule" (at least once a day) and specify your schedule, and as Target specify the lambda function you crated with the content of the file "backup-ebs-lambda.js"
Create a new event, but this time with target to the lambda function to delete the snapshot (it's better if you set the schedule to happen before the creation of the snapshot)
