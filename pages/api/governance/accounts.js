import axios from "axios"; // Axios requests

export default async (req, res) => {
  // pagination logic
  let { page_number = 1, page_size = 10 } = req.query;
  page_number = Number(page_number);
  page_size = Number(page_size);
  const offset = (page_number - 1) * page_size;
  const total_pages = Math.ceil(2000 / page_size);
  let pagination_summary = { total_pages, page_size, page_number };
  if (
    pagination_summary.page_number < 1 ||
    pagination_summary.page_number > pagination_summary.total_pages
  ) {
    res.status(400).send("Invalid page number");
    return;
  }

  // Fetch top delegates from thegraph
  const graphRes = await axios.post(
    "https://api.thegraph.com/subgraphs/name/arr00/uniswap-governance-v2",
    {
      query:
        `{
					delegates(first:` +
        page_size +
        `, orderBy:delegatedVotes, orderDirection:desc, skip:` +
        offset +
        `) {
						id
						delegatedVotes
            numberVotes
            votes {
              id
            }
					}
				}`,
    }
  );
  const accounts = graphRes.data.data.delegates;

  // Combine maps recieved from thegraph and tally
  for (const x in accounts) {
    let a = accounts[x];
    a.address = a.id;
    a.proposals_voted = a.numberVotes;
    a.votes = a.delegatedVotes;
    delete a.delegatedVotes;
    delete a.id;

    accounts[x] = a;
    accounts[x]["rank"] = Number(x) + offset + 1;
  }

  let resData = { accounts, pagination_summary };
  res.json(resData);
};
