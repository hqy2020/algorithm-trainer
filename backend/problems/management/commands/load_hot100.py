from django.core.management.base import BaseCommand
from problems.models import Problem


# (题号, 标题, 难度, 分类, 建议用时, URL slug)
# 分类与 LeetCode 官方「热题 100」学习计划一致
# https://leetcode.cn/studyplan/top-100-liked/
HOT_100 = [
    # ── 哈希 ──
    (1, '两数之和', 'Easy', '哈希', 10, 'two-sum'),
    (49, '字母异位词分组', 'Medium', '哈希', 15, 'group-anagrams'),
    (128, '最长连续序列', 'Medium', '哈希', 20, 'longest-consecutive-sequence'),
    # ── 双指针 ──
    (283, '移动零', 'Easy', '双指针', 10, 'move-zeroes'),
    (11, '盛最多水的容器', 'Medium', '双指针', 15, 'container-with-most-water'),
    (15, '三数之和', 'Medium', '双指针', 20, '3sum'),
    (42, '接雨水', 'Hard', '双指针', 30, 'trapping-rain-water'),
    # ── 滑动窗口 ──
    (3, '无重复字符的最长子串', 'Medium', '滑动窗口', 20, 'longest-substring-without-repeating-characters'),
    (438, '找到字符串中所有字母异位词', 'Medium', '滑动窗口', 20, 'find-all-anagrams-in-a-string'),
    # ── 子串 ──
    (560, '和为 K 的子数组', 'Medium', '子串', 20, 'subarray-sum-equals-k'),
    (239, '滑动窗口最大值', 'Hard', '子串', 25, 'sliding-window-maximum'),
    (76, '最小覆盖子串', 'Hard', '子串', 30, 'minimum-window-substring'),
    # ── 普通数组 ──
    (53, '最大子数组和', 'Medium', '普通数组', 15, 'maximum-subarray'),
    (56, '合并区间', 'Medium', '普通数组', 15, 'merge-intervals'),
    (189, '轮转数组', 'Medium', '普通数组', 15, 'rotate-array'),
    (238, '除自身以外数组的乘积', 'Medium', '普通数组', 15, 'product-of-array-except-self'),
    (41, '缺失的第一个正数', 'Hard', '普通数组', 25, 'first-missing-positive'),
    # ── 矩阵 ──
    (73, '矩阵置零', 'Medium', '矩阵', 15, 'set-matrix-zeroes'),
    (54, '螺旋矩阵', 'Medium', '矩阵', 20, 'spiral-matrix'),
    (48, '旋转图像', 'Medium', '矩阵', 15, 'rotate-image'),
    (240, '搜索二维矩阵 II', 'Medium', '矩阵', 15, 'search-a-2d-matrix-ii'),
    # ── 链表 ──
    (160, '相交链表', 'Easy', '链表', 10, 'intersection-of-two-linked-lists'),
    (206, '反转链表', 'Easy', '链表', 10, 'reverse-linked-list'),
    (234, '回文链表', 'Easy', '链表', 15, 'palindrome-linked-list'),
    (141, '环形链表', 'Easy', '链表', 10, 'linked-list-cycle'),
    (142, '环形链表 II', 'Medium', '链表', 15, 'linked-list-cycle-ii'),
    (21, '合并两个有序链表', 'Easy', '链表', 10, 'merge-two-sorted-lists'),
    (2, '两数相加', 'Medium', '链表', 20, 'add-two-numbers'),
    (19, '删除链表的倒数第 N 个结点', 'Medium', '链表', 15, 'remove-nth-node-from-end-of-list'),
    (24, '两两交换链表中的节点', 'Medium', '链表', 15, 'swap-nodes-in-pairs'),
    (25, 'K 个一组翻转链表', 'Hard', '链表', 35, 'reverse-nodes-in-k-group'),
    (138, '随机链表的复制', 'Medium', '链表', 20, 'copy-list-with-random-pointer'),
    (148, '排序链表', 'Medium', '链表', 25, 'sort-list'),
    (23, '合并 K 个升序链表', 'Hard', '链表', 30, 'merge-k-sorted-lists'),
    (146, 'LRU 缓存', 'Medium', '链表', 25, 'lru-cache'),
    # ── 二叉树 ──
    (94, '二叉树的中序遍历', 'Easy', '二叉树', 10, 'binary-tree-inorder-traversal'),
    (104, '二叉树的最大深度', 'Easy', '二叉树', 10, 'maximum-depth-of-binary-tree'),
    (226, '翻转二叉树', 'Easy', '二叉树', 10, 'invert-binary-tree'),
    (101, '对称二叉树', 'Easy', '二叉树', 10, 'symmetric-tree'),
    (543, '二叉树的直径', 'Easy', '二叉树', 15, 'diameter-of-binary-tree'),
    (102, '二叉树的层序遍历', 'Medium', '二叉树', 15, 'binary-tree-level-order-traversal'),
    (108, '将有序数组转换为二叉搜索树', 'Easy', '二叉树', 15, 'convert-sorted-array-to-binary-search-tree'),
    (98, '验证二叉搜索树', 'Medium', '二叉树', 15, 'validate-binary-search-tree'),
    (230, '二叉搜索树中第K小的元素', 'Medium', '二叉树', 15, 'kth-smallest-element-in-a-bst'),
    (199, '二叉树的右视图', 'Medium', '二叉树', 15, 'binary-tree-right-side-view'),
    (114, '二叉树展开为链表', 'Medium', '二叉树', 20, 'flatten-binary-tree-to-linked-list'),
    (105, '从前序与中序遍历序列构造二叉树', 'Medium', '二叉树', 25, 'construct-binary-tree-from-preorder-and-inorder-traversal'),
    (437, '路径总和 III', 'Medium', '二叉树', 20, 'path-sum-iii'),
    (236, '二叉树的最近公共祖先', 'Medium', '二叉树', 20, 'lowest-common-ancestor-of-a-binary-tree'),
    (124, '二叉树中的最大路径和', 'Hard', '二叉树', 30, 'binary-tree-maximum-path-sum'),
    # ── 图论 ──
    (200, '岛屿数量', 'Medium', '图论', 15, 'number-of-islands'),
    (994, '腐烂的橘子', 'Medium', '图论', 15, 'rotting-oranges'),
    (207, '课程表', 'Medium', '图论', 20, 'course-schedule'),
    (208, '实现 Trie (前缀树)', 'Medium', '图论', 20, 'implement-trie-prefix-tree'),
    # ── 回溯 ──
    (46, '全排列', 'Medium', '回溯', 15, 'permutations'),
    (78, '子集', 'Medium', '回溯', 15, 'subsets'),
    (17, '电话号码的字母组合', 'Medium', '回溯', 20, 'letter-combinations-of-a-phone-number'),
    (39, '组合总和', 'Medium', '回溯', 20, 'combination-sum'),
    (22, '括号生成', 'Medium', '回溯', 20, 'generate-parentheses'),
    (79, '单词搜索', 'Medium', '回溯', 20, 'word-search'),
    (131, '分割回文串', 'Medium', '回溯', 20, 'palindrome-partitioning'),
    (51, 'N 皇后', 'Hard', '回溯', 35, 'n-queens'),
    # ── 二分查找 ──
    (35, '搜索插入位置', 'Easy', '二分查找', 10, 'search-insert-position'),
    (74, '搜索二维矩阵', 'Medium', '二分查找', 15, 'search-a-2d-matrix'),
    (34, '在排序数组中查找元素的第一个和最后一个位置', 'Medium', '二分查找', 15, 'find-first-and-last-position-of-element-in-sorted-array'),
    (33, '搜索旋转排序数组', 'Medium', '二分查找', 20, 'search-in-rotated-sorted-array'),
    (153, '寻找旋转排序数组中的最小值', 'Medium', '二分查找', 15, 'find-minimum-in-rotated-sorted-array'),
    (4, '寻找两个正序数组的中位数', 'Hard', '二分查找', 35, 'median-of-two-sorted-arrays'),
    # ── 栈 ──
    (20, '有效的括号', 'Easy', '栈', 10, 'valid-parentheses'),
    (155, '最小栈', 'Medium', '栈', 15, 'min-stack'),
    (394, '字符串解码', 'Medium', '栈', 20, 'decode-string'),
    (739, '每日温度', 'Medium', '栈', 15, 'daily-temperatures'),
    (84, '柱状图中最大的矩形', 'Hard', '栈', 30, 'largest-rectangle-in-histogram'),
    # ── 堆 ──
    (215, '数组中的第K个最大元素', 'Medium', '堆', 15, 'kth-largest-element-in-an-array'),
    (347, '前 K 个高频元素', 'Medium', '堆', 15, 'top-k-frequent-elements'),
    (295, '数据流的中位数', 'Hard', '堆', 30, 'find-median-from-data-stream'),
    # ── 贪心 ──
    (121, '买卖股票的最佳时机', 'Easy', '贪心', 10, 'best-time-to-buy-and-sell-stock'),
    (55, '跳跃游戏', 'Medium', '贪心', 15, 'jump-game'),
    (45, '跳跃游戏 II', 'Medium', '贪心', 20, 'jump-game-ii'),
    (763, '划分字母区间', 'Medium', '贪心', 15, 'partition-labels'),
    # ── 动态规划 ──
    (70, '爬楼梯', 'Easy', '动态规划', 10, 'climbing-stairs'),
    (118, '杨辉三角', 'Easy', '动态规划', 10, 'pascals-triangle'),
    (198, '打家劫舍', 'Medium', '动态规划', 15, 'house-robber'),
    (279, '完全平方数', 'Medium', '动态规划', 20, 'perfect-squares'),
    (322, '零钱兑换', 'Medium', '动态规划', 20, 'coin-change'),
    (139, '单词拆分', 'Medium', '动态规划', 20, 'word-break'),
    (300, '最长递增子序列', 'Medium', '动态规划', 20, 'longest-increasing-subsequence'),
    (152, '乘积最大子数组', 'Medium', '动态规划', 20, 'maximum-product-subarray'),
    (416, '分割等和子集', 'Medium', '动态规划', 25, 'partition-equal-subset-sum'),
    (32, '最长有效括号', 'Hard', '动态规划', 30, 'longest-valid-parentheses'),
    # ── 多维动态规划 ──
    (62, '不同路径', 'Medium', '多维动态规划', 15, 'unique-paths'),
    (64, '最小路径和', 'Medium', '多维动态规划', 15, 'minimum-path-sum'),
    (5, '最长回文子串', 'Medium', '多维动态规划', 25, 'longest-palindromic-substring'),
    (1143, '最长公共子序列', 'Medium', '多维动态规划', 20, 'longest-common-subsequence'),
    (72, '编辑距离', 'Medium', '多维动态规划', 25, 'edit-distance'),
    # ── 技巧 ──
    (136, '只出现一次的数字', 'Easy', '技巧', 10, 'single-number'),
    (169, '多数元素', 'Easy', '技巧', 10, 'majority-element'),
    (75, '颜色分类', 'Medium', '技巧', 15, 'sort-colors'),
    (31, '下一个排列', 'Medium', '技巧', 20, 'next-permutation'),
    (287, '寻找重复数', 'Medium', '技巧', 20, 'find-the-duplicate-number'),
]


class Command(BaseCommand):
    help = '导入 LeetCode 热题 100（官方学习计划版本）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean', action='store_true',
            help='删除不在 Hot 100 列表中的旧题目（会级联删除关联的提交和笔记）',
        )

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        valid_numbers = set()

        for idx, (number, title, difficulty, category, time_std, slug) in enumerate(HOT_100, start=1):
            valid_numbers.add(number)
            _, created = Problem.objects.update_or_create(
                number=number,
                defaults={
                    'hot100_order': idx,
                    'title': title,
                    'difficulty': difficulty,
                    'category': category,
                    'time_standard': time_std,
                    'leetcode_url': f'https://leetcode.cn/problems/{slug}/',
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        # 处理非 Hot 100 的旧题目
        extra = Problem.objects.exclude(number__in=valid_numbers)
        extra_count = extra.count()

        if extra_count and options['clean']:
            extra.delete()
            self.stdout.write(self.style.WARNING(
                f'已移除 {extra_count} 道非 Hot 100 题目及其关联数据'
            ))
        elif extra_count:
            numbers = ', '.join(str(p.number) for p in extra)
            self.stdout.write(self.style.WARNING(
                f'数据库中有 {extra_count} 道非 Hot 100 题目 ({numbers})，'
                f'使用 --clean 参数可移除'
            ))

        self.stdout.write(self.style.SUCCESS(
            f'导入完成：新增 {created_count} 题，更新 {updated_count} 题，'
            f'共 {len(HOT_100)} 题'
        ))
