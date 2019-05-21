# Tradeoff Analytics Node Starter Application

## DEPRECATED: this repo is no longer actively maintained. It can still be used as reference, but may contain outdated or unpatched code.

  The IBM Watson [Tradeoff Analytics][service_url] service helps you make
  better choices under multiple conflicting goals. The service combines smart
  visualization and recommendations for tradeoff exploration.

Give it a try! Click the button below to fork into IBM DevOps Services and deploy your own copy of this application on Bluemix.

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/watson-developer-cloud/tradeoff-analytics-nodejs)

## Getting Started

1. Create a Bluemix Account

    [Sign up][sign_up] in Bluemix, or use an existing account.

2. Download and install the [Cloud-foundry CLI][cloud_foundry] tool

3. Edit the `manifest.yml` file and change the `<application-name>` to something unique.
  ```none
  applications:
  - services:
    - tradeoff-analytics-standard-service
    name: <application-name>
    command: node app.js
    path: .
    memory: 256M
  ```
  The name you use will determinate your application url initially, e.g. `<application-name>.mybluemix.net`.

4. Connect to Bluemix in the command line tool.
  ```sh
  $ cf api https://api.ng.bluemix.net
  $ cf login -u <your user ID>
  ```

5. Create the Tradeoff Analytics service in Bluemix.
  ```sh
  $ cf create-service tradeoff_analytics standard tradeoff-analytics-standard-service
  ```

6. Push it live!
  ```sh
  $ cf push
  ```

See the full [Getting Started][getting_started] documentation for more details, including code snippets and references.

## Running locally
  The application uses [Node.js](http://nodejs.org/) and [npm](https://www.npmjs.com/) so you will have to download and install them as part of the steps below.

1. Copy the credentials from your `tradeoff-analytics-standard-service` service in Bluemix to `app.js` (or environment properties, or a [.env file]). You can see the credentials using:

    ```sh
    $ cf env <application-name>
    ```
    Example output:
    ```sh
    System-Provided:
    {
    "VCAP_SERVICES": {
      "tradeoff_analytics": [{
          "credentials": {
            "url": "<url>",
            "password": "<password>",
            "username": "<username>"
          },
        "label": "tradeoff-analytics",
        "name": "tradeoff-analytics-standard-service",
        "plan": "standard"
     }]
    }
    }
    ```

    You need to copy `username`, `password` and `url`.
2. Install [Node.js](http://nodejs.org/)
3. Go to the project folder in a terminal and run `npm install`
4. Start the application: `npm start`
6. Go to `http://localhost:3000`

## Troubleshooting

To troubleshoot your Bluemix app the main useful source of information are the logs, to see them, run:

  ```sh
  $ cf logs <application-name> --recent
  ```

## Getting Help

If you get stuck, try [dW Answers] or [Stack Overflow] first, as you will generally get a faster response there.
However, you may also [file a ticket here][github], especially if you believe there is an issue is in the demo app itself.


## License

This sample code is licensed under Apache 2.0. Full license text is available in [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md).


## Open Source @ IBM

Find more open source projects on the [IBM Github Page](http://ibm.github.io/)


## Privacy Notice

This node sample web application includes code to track deployments to Bluemix and other [Cloud Foundry] platforms. The following information is sent to a [Deployment Tracker][deploy_track_url] service on each deployment:

* Application Name (`application_name`)
* Space ID (`space_id`)
* Application Version (`application_version`)
* Application URIs (`application_uris`)

This data is collected from the `VCAP_APPLICATION` environment variable in IBM Bluemix and other Cloud Foundry platforms. This data is used by IBM to track metrics around deployments of sample applications to IBM Bluemix. Only deployments of sample applications that include code to ping the Deployment Tracker service will be tracked.

### Disabling Deployment Tracking

Deployment tracking can be disabled by removing `require('cf-deployment-tracker-client').track();` from the beginning of the `server.js` file at the root of this repo.

[deploy_track_url]: https://github.com/cloudant-labs/deployment-tracker

[service_url]: http://www.ibm.com/watson/developercloud/tradeoff-analytics.html
[cloud_foundry]: https://github.com/cloudfoundry/cli
[getting_started]: https://www.ibm.com/watson/developercloud/doc/common/index.html
[sign_up]: https://console.ng.bluemix.net/registration/
[.env file]: https://www.npmjs.com/package/dotenv
[dW answers]: https://developer.ibm.com/answers/smart-spaces/25/watson.html
[Stack Overflow]: http://stackoverflow.com/questions/tagged/ibm-watson
[github]: https://github.com/watson-developer-cloud/tradeoff-analytics-nodejs/issues
