for i in range(1, 6):
    with open(f"siedler{i}.txt") as f:
        f.readline()
        print('Vieleck(', end='')
        for i, l in enumerate(f):
            x, y = map(int, map(float, l.split()))
            print(f"{',' if i > 0 else ''}({x},{y})", end='')
        print(')')