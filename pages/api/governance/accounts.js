import axios from "axios"; // Axios requests

export default async (req, res) => {
  // Pagation logic
  let { page_number = 1, page_size = 10 } = req.query;
  const offset = (page_number - 1) * page_size;
  const total_pages = Math.ceil(2000 / page_size);
  let pagation_summary = { total_pages, page_size, page_number };
  if (
    pagation_summary.page_number < 1 ||
    pagation_summary.page_number > pagation_summary.total_pages
  ) {
    res.status(400).send("Invalid page number");
    return;
  }

  // Fetch top delegates from thegraph
  const graphRes = await axios.post(
    "https://api.thegraph.com/subgraphs/name/ianlapham/governance-tracking",
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
					}
				}`,
    }
  );
  const accounts = graphRes.data.data.delegates;

  const tallyRes = await axios.post(
    "https://identity.withtally.com/user/profiles/by/address",
    {
      addresses: accounts.map((x) => x.id),
    }
  );
  const tallyAccountsData = tallyRes.data.data.usersByAddress;

  // Combine maps recieved from thegraph and tally
  for (const x in accounts) {
    let a = accounts[x];
    let b = tallyAccountsData[accounts[x].id];
    accounts[x] = Object.assign({}, a, b);
    accounts[x]["rank"] = Number(x) + offset + 1;
  }

  let resData = { accounts, pagation_summary };
  res.json(resData);
};
