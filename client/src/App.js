import React, { Component } from 'react';
import './App.css';
const Highcharts = require('react-highcharts'); 

const EPOCH = 50 //TODO: find way to find epoch size without hardcoding

class App extends Component {

  constructor() {
    super();

    this.state = {
      blockHistory: {},
      currentBlock: null,
      charts: {
        'login': this.grabLoginHistoryData,
        'deposits': this.grabDepositsHistoryData,
        'votes': this.grabVotesHistoryData
      }
    }

    this.grabLoginHistoryData = this.grabLoginHistoryData.bind(this);
    this.grabDepositsHistoryData = this.grabDepositsHistoryData.bind(this);
    this.grabVotesHistoryData = this.grabVotesHistoryData.bind(this);
    this.grabHighcharts = this.grabHighcharts.bind(this);

  }  
  
  // Can probably group the three functions below into one
  // unless graph becomes more complicated
  grabLoginHistoryData() {

    var xAxis = [], yAxis = []

    for (var block in this.state.blockHistory) {
      let info = this.state.blockHistory[block]
      let validatorTotal = info.validator_total
      
      xAxis.push(block)
      yAxis.push(validatorTotal)
    }

    return {
      title: "Validator Login History".toUpperCase(),
      yAxisTitle: "# of Validators",
      xAxis: xAxis,
      yAxis: yAxis
    }
  }

  grabDepositsHistoryData() {
 
    var xAxis = [], yAxis = []

    for (var block in this.state.blockHistory) {
      let info = this.state.blockHistory[block]
      let currentDeposits = info.cur_deposits
      
      xAxis.push(block)
      yAxis.push(currentDeposits)
    }

    return {
      title: "Validator Deposit History".toUpperCase(),
      yAxisTitle: "Total Deposits",
      xAxis: xAxis,
      yAxis: yAxis
    }
  }

  grabVotesHistoryData() {

    var xAxis = [], yAxis = []

    for (var block in this.state.blockHistory) {
      let info = this.state.blockHistory[block]
      let currentVotes = info.cur_votes
      
      xAxis.push(block)
      yAxis.push(currentVotes)
    }
    
    return {
      title: "Validator Vote History".toUpperCase(),
      yAxisTitle: "Votes",
      xAxis: xAxis,
      yAxis: yAxis
    }
  }

  componentDidMount() {
 
      // Start listening
      let socket = new window.Primus("http://localhost:3001")
      let that = this

      socket.on('open', function open() {
        socket.emit('ready');
        console.log('The client connection has been opened.');
      })
      .on('end', function end() {
        console.log('Socket connection ended.')
      })
      .on('error', function error(err) {
        console.log(err);
      })
      .on('reconnecting', function reconnecting(opts) {
        console.log('We are scheduling a reconnect operation', opts);
      })
      .on('data', function incoming(info) {

        // Persist data
        switch (info.action) {
          case "casper": {
            let casper_info = info.data.casper
            let ce = casper_info.current_epoch
            let block = that.state.currentBlock

            // Add casper info to block
            if (block && block in that.state.blockHistory && !that.state.blockHistory[block].length) {
              var blockHistory = {...that.state.blockHistory}
              blockHistory[block] = casper_info

              that.setState({blockHistory})
            }

            break
          }
          case "block": {
            let block_info = info.data
            let block = block_info.number  
            let epoch = block / EPOCH 

            // Add block to history
            if (!(block in that.state.blockHistory)) {
              var blockHistory = {...that.state.blockHistory}
              blockHistory[block] = {}
            
              that.setState({blockHistory, currentBlock: block})
            }

            break
          }
          default:
            // error
        }
      });

      socket.on('init', function(data)
      {
        console.log(data)
      });

      socket.on('client-latency', function(data)
      {
        console.log(data)
      })

  }

  grabHighcharts() {
    var charts = []
    for (var type in this.state.charts) {
      let data = this.state.charts[type].call(this)
      charts.push(data) 
    }
    return charts
  }

  drawCharts(chartData) {
    return chartData.map((chart) => {
         
        return <Highcharts 
            config = {{
              chart: {
                backgroundColor: "#000"
              },
              title: {
                  text: chart.title,
                  style: {
                    color: "#fff",
                    font: "2em"
                  }
              },
              subtitle: {
                  text: ''
              },
              xAxis: {
                  title: {
                    text: 'block number'
                  },
                  categories: chart.xAxis //e.g. [1,2,3,4,5,6,7,8,9,10]
              },
              yAxis: {
                  title: {
                      text: chart.yAxisTitle
                  },
                  gridLineColor: '#222'
              },
              plotOptions: {
                  series: {
                      label: {
                          connectorAllowed: false
                      }
                  }
              },
              series: [{
                  name: chart.yAxisTitle,
                  data: chart.yAxis //e.g. [32,44,63,123,150,200,536,800,1023,1214]
              }]
            }}
          >
        </Highcharts>
    })
  }

  render() {

    let chartData = this.grabHighcharts()
     
    let charts = this.drawCharts(chartData)
    
    return (
      <div className="App">
         { charts }
      </div>
    );
  }
}

export default App;
