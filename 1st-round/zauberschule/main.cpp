#include <bits/stdc++.h>

using namespace std;

#define ll long long
#define pli pair<ll, int>
#define tlii tuple<ll, int, int>
#define INF(T) numeric_limits<T>::max()

vector<pli> dijkstra_path(vector<vector<pli>> &adj, int start) {
    vector<pli> dist(adj.size(), {INF(ll), -1});
    priority_queue<tlii, vector<tlii>, greater<tlii>> pq;
    pq.push({0, start, -1});
    while (!pq.empty()) {
        auto [d, v, p] = pq.top();
        pq.pop();
        if (dist[v].first <= d) continue;
        dist[v] = {d, p};
        for (auto [w, u] : adj[v])
            pq.push({d + w, u, v});
    }
    return dist;
}

vector<int> extract_path_to(vector<pli> &dist, int desti) {
    vector<int> path;
    do {
        path.push_back(desti);
        desti = dist[desti].second;
    } while(desti >= 0);
    reverse(path.begin(), path.end());
    return path;
}

int main() {
    int h, w;
    cin >> h >> w;
    vector<bool> empty(w * h * 2, false);
    vector<vector<pli>> adj(w * h * 2);
    int start, desti;
    for (int s = 0; s < 2; s++) {
        for (int y = 0; y < h; y++) {
            string str;
            cin >> str;
            for (int x = 0; x < w; x++) {
                int v = s * (h * w) + y * w + x;
                char ch = str[x];
                if (ch == '#') continue;
                
                empty[v] = true;
                if (ch == 'A') start = v;
                else if (ch == 'B') desti = v;

                int left = v - 1;
                int top = v - w;
                int down = v - w * h;
                
                if (left >= 0 && empty[left]) {
                    adj[v].push_back({1, left});
                    adj[left].push_back({1, v});
                }
                if (top >= 0 && empty[top]) {
                    adj[v].push_back({1, top});
                    adj[top].push_back({1, v});
                }
                if (down >= 0 && empty[down]) {
                    adj[v].push_back({3, down});
                    adj[down].push_back({3, v});
                }
            }
        }
        cin.ignore(INF(streamsize), '\n'); // skips empty line
    }

    vector<pli> dist = dijkstra_path(adj, start);
    vector<int> path = extract_path_to(dist, desti);

    cout << "Steps: " << path.size() - 1 << "\n";
    cout << "Duration: " << dist[desti].first << "s\n";
    cout << "Path: \nA";
    for (int i = 1; i < path.size(); i++) {
        int diff = path[i] - path[i - 1];
        if (diff == -1) cout << "<";
        else if (diff == 1) cout << ">";
        else if (diff == -w) cout << "^";
        else if (diff == w) cout << "v";
        else if (diff == -w * h) cout << "!";
        else if (diff == w * h) cout << "?";
    }
    cout << "B\n";
    
    return 0;
}