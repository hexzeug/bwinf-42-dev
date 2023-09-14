#include <bits/stdc++.h>

#define point tuple<int, int, bool>
#define edge tuple<int, int, int>

using namespace std;

int main() {
    int N;
    cin >> N;
    vector<point> origTour(N);
    vector<string> nameList;
    vector<list<edge>> adj;
    adj.reserve(N);

    {
        unordered_map<string, int> nameMap(N);
        nameMap.reserve(N);
        int old_pos = 0;
        int u = -1;
        
        for (int i = 0; i < N; i++) {
            string name, year, essen, pos;
            getline(cin, name, ',');
            getline(cin, year, ',');
            getline(cin, essen, ',');
            getline(cin, pos);
            if (nameMap.count(name) == 0) {
                nameMap[name] = nameList.size();
                nameList.push_back(name);
                adj.push_back({});
            }
            int v = nameMap[name], y = stoi(year), p = stoi(pos);
            bool e = essen == "X";
            int w = p - old_pos;
            old_pos = p;
            origTour[i] = {v, y, e};
            if (u >= 0) {
                adj[u].push_back({v, y, w});
            }
            u = v;
        }
    }

    return 0;
}