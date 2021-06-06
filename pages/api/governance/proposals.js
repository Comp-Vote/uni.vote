import Web3 from "web3"; // Web3
import axios from "axios"; // Axios requests
import {
  GOVERNER_ALPHA_ABI,
  GOVERNANCE_ADDRESS,
  MULTICALL_ABI,
  MULTICALL_ADDRESS,
} from "helpers/abi"; // Contract ABIs + Addresses

const statesKey = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed"
  ];

/**
 * Instantiates server-side web3 connection
 */
const Web3Handler = () => {
  // Setup web3 handler
  const web3 = new Web3(process.env.NEXT_PUBLIC_INFURA_RPC);

  // Setup contracts
  const multicall = new web3.eth.Contract(MULTICALL_ABI, MULTICALL_ADDRESS);
  const governanceAlpha = new web3.eth.Contract(
    GOVERNER_ALPHA_ABI,
    GOVERNANCE_ADDRESS
  );

  // Return web3 + contracts
  return {
    web3,
    governanceAlpha,
    multicall,
  };
};

export default async (req, res) => {
  const { page_number } = req.query;

  const {web3,governanceAlpha,multicall} = Web3Handler();
  let proposalCount = await governanceAlpha.methods.proposalCount().call();
  console.log(proposalCount);
  const offset = page_number*10;
  if(proposalCount < offset) {
    res.status(400).end();
    return;
  }

  let graphRes, states;

  [graphRes, states] = await Promise.all([
    axios.post(
      "https://api.thegraph.com/subgraphs/name/ianlapham/governance-tracking",
      {
        query:
        `{
          proposals(first:10 skip:` + offset +` orderBy:startBlock) {
            id
            description
          }
        }`,
      }
    ),
    multicall.methods
      .aggregate(
        genCalls(
          "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F",
          "0x3e4f49e6",
          offset + 1,
          offset + 10 > proposalCount ? proposalCount : offset + 10,
          web3
        )
      )
      .call(),
  ]);
  let stringStates = [];
  for (const state of states["returnData"]) {
    stringStates.push(statesKey[Number(state[state.length - 1])]);
  }
  console.log(graphRes.data.errors);
  let resData = [];
  for (const proposal of graphRes.data.data.proposals) {
    //console.log(proposal)
    let newProposal = {};
    newProposal["title"] = proposal.description.split("\n")[0].substring(2);
    newProposal["proposalId"] = proposal.id;
    newProposal["state"] = stringStates.shift();
    resData.push(newProposal); 
  }
  res.json(resData);
};

function genCalls(target, callPrefix, first, last,web3) {
  let res = [];
  for (let i = first; i <= last; i++) {
    res.push({
      target: target,
      callData:
        callPrefix + web3.eth.abi.encodeParameter("uint256", i).substring(2),
    });
  }
  return res;
}
