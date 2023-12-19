#include <bits/stdc++.h>

using namespace std;

#define ll long long
#define pli pair<ll, int>
#define tlii tuple<ll, int, int>
#define INF(T) numeric_limits<T>::max()

vector<pli> dijkstra_path(vector<vector<pli>> &adj, int start);
vector<int> extract_path_to(vector<pli> &dist, int desti);

int main() {

    // read in
    
    int h, w;                           // h: height, w: width
    cin >> h >> w;
    vector<bool> hallway(w * h * 2, false);
    vector<vector<pli>> adj(w * h * 2); // adj: adjacency list
    int start = -1, desti = -1;         // start: start,
                                        // desti: destination
    for (int s = 0; s < 2; s++) {       // s: story
        for (int y = 0; y < h; y++) {   // y: y-coordinate
            string line;
            cin >> line;
            for (int x = 0; x < w; x++) { // x: x-coordinate
                char ch = line[x];        // ch: character
                if (ch == '#') continue;

                int v = s * (h * w) + y * w + x; // v: vertex
                hallway[v] = true;
                if (ch == 'A') start = v;
                else if (ch == 'B') desti = v;

                int west = v - 1;
                int north = v - w;
                int down = v - w * h;
                
                if (west >= 0 && hallway[west]) {
                    adj[v].push_back({1, west});
                    adj[west].push_back({1, v});
                }
                if (north >= 0 && hallway[north]) {
                    adj[v].push_back({1, north});
                    adj[north].push_back({1, v});
                }
                if (down >= 0 && hallway[down]) {
                    adj[v].push_back({3, down});
                    adj[down].push_back({3, v});
                }
            }
        }
        cin.ignore(INF(streamsize), '\n'); // skips empty line
    }

    // find path

    vector<pli> dist = dijkstra_path(adj, start); // dist: distances
    vector<int> path = extract_path_to(dist, desti);

    // output

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

vector<pli> dijkstra_path(vector<vector<pli>> &adj, int start) {
            // adj: adjacency list, start: start vetex's index
    vector<pli> dist(adj.size(), {INF(ll), -1}); // dist: distances
                                                 //   from start to
                                                 //   each vertex
    priority_queue<tlii, vector<tlii>, greater<tlii>> pq;
    pq.push({0, start, -1});
    while (!pq.empty()) {
        auto [d, v, p] = pq.top(); // d: distance, v: vertex's index,
                                   // p: predecessor's index
        pq.pop();
        if (dist[v].first <= d) continue;
        dist[v] = {d, p};
        for (auto [w, u] : adj[v]) // w: weight, u: vertex 2's index
            pq.push({d + w, u, v});
    }
    return dist;
}

vector<int> extract_path_to(vector<pli> &dist, int desti) {
            //dist: distances, desti: destination vertex's index
    vector<int> path;
    do {
        path.push_back(desti);
        desti = dist[desti].second;
    } while(desti >= 0);
    reverse(path.begin(), path.end());
    return path;
}