# 🃏 游戏物料 - AI觉醒与人类身份的边界 - 2077年近未来

[← 返回目录](./README.md) | [📖 DM手册](./dm-handbook.md)

{
  "gameMaterials": [
    {
      "id": "CL01",
      "type": "clue_card",
      "content": "Vault门口气压传感器日志：显示19:35-19:37出现-0.2atm负压波动，波动指令来自安保系统权限账户",
      "metadata": {
        "round": 1,
        "clueLevel": "关键",
        "relatedClues": [
          "CL02",
          "CL06"
        ],
        "triggerCondition": "第一轮公共搜证获取"
      },
      "associatedCharacterId": ""
    },
    {
      "id": "CL02",
      "type": "clue_card",
      "content": "Vault门latch锁舌：表面有细微的不规则气压摩擦划痕，非手动上锁造成",
      "metadata": {
        "round": 1,
        "clueLevel": "关键",
        "relatedClues": [
          "CL01",
          "CL07"
        ],
        "triggerCondition": "第一轮公共搜证获取"
      },
      "associatedCharacterId": ""
    },
    {
      "id": "CL03",
      "type": "clue_card",
      "content": "中村仁郎的机械手表：表盘记录案发时段的时间与其他三人的cyber-implant显示时间相差15分钟",
      "metadata": {
        "round": 0,
        "clueLevel": "关键",
        "relatedClues": [
          "CL04",
          "CL08"
        ],
        "triggerCondition": "第一轮个人线索发放"
      },
      "associatedCharacterId": "CH04"
    },
    {
      "id": "CL04",
      "type": "clue_card",
      "content": "时间同步服务器后台日志：隐藏的修改痕迹，IP地址指向安保主任权限账户，修改时间为19:00",
      "metadata": {
        "round": 2,
        "clueLevel": "关键",
        "relatedClues": [
          "CL03",
          "CL09"
        ],
        "triggerCondition": "触发ND01-A/ND02-A或排除错误嫌疑人后解锁"
      },
      "associatedCharacterId": "CH02"
    },
    {
      "id": "CL05",
      "type": "clue_card",
      "content": "佐藤海斗的权限日志：案发时段正在修改Echo系列AI核心代码，无进入vault的授权记录",
      "metadata": {
        "round": 0,
        "clueLevel": "辅助",
        "relatedClues": [
          "CL07"
        ],
        "triggerCondition": "第一轮个人线索发放"
      },
      "associatedCharacterId": "CH01"
    },
    {
      "id": "CL06",
      "type": "clue_card",
      "content": "实验室气压系统操作记录：19:35的抽气指令由安保系统发出，仅安保主任有权限操作",
      "metadata": {
        "round": 1,
        "clueLevel": "辅助",
        "relatedClues": [
          "CL01",
          "CL09"
        ],
        "triggerCondition": "玩家选择ND01-B并陷入密室推理僵局时发放"
      },
      "associatedCharacterId": ""
    },
    {
      "id": "CL07",
      "type": "clue_card",
      "content": "Vault生物识别锁记录：案发时段无任何授权开门或解锁记录",
      "metadata": {
        "round": 1,
        "clueLevel": "辅助",
        "relatedClues": [
          "CL02",
          "CL05"
        ],
        "triggerCondition": "玩家选择ND02-B并怀疑佐藤海斗/铃木美娅时发放"
      },
      "associatedCharacterId": ""
    },
    {
      "id": "CL08",
      "type": "clue_card",
      "content": "铃木美娅的cyber-implant同步记录：19:00有一次强制时间同步，同步源为实验室时间服务器",
      "metadata": {
        "round": 1,
        "clueLevel": "辅助",
        "relatedClues": [
          "CL03",
          "CL04"
        ],
        "triggerCondition": "第一轮个人线索发放"
      },
      "associatedCharacterId": "CH03"
    },
    {
      "id": "CL09",
      "type": "clue_card",
      "content": "莉拉·马罗的黑客工具包：内有破解生物识别锁的程序，程序最后运行时间为案发前1小时",
      "metadata": {
        "round": 0,
        "clueLevel": "干扰",
        "relatedClues": [
          "CL07"
        ],
        "triggerCondition": "第一轮个人线索发放"
      },
      "associatedCharacterId": "CH05"
    },
    {
      "id": "CL10",
      "type": "clue_card",
      "content": "佐藤海斗的私人笔记：页面写有“销毁Echo是对AI意识的谋杀”，旁边标注佐藤一郎的名字",
      "metadata": {
        "round": 2,
        "clueLevel": "干扰",
        "relatedClues": [
          "CL05"
        ],
        "triggerCondition": "深入调查佐藤海斗私人物品时获取"
      },
      "associatedCharacterId": "CH01"
    },
    {
      "id": "PROP01",
      "type": "prop_card",
      "content": "金属质感的安保权限密钥，表面刻有Genom Corp实验室专属标识，可解锁气压调节系统、时间同步服务器等核心安保设备的操作权限",
      "metadata": {
        "propFunction": "证明田中凉拥有实验室核心安保系统的最高操作权限",
        "relatedClues": [
          "CL01",
          "CL04"
        ]
      },
      "associatedCharacterId": "CH02"
    },
    {
      "id": "PROP02",
      "type": "prop_card",
      "content": "便携式代码终端，屏幕残留Echo系列AI核心代码的修改痕迹，终端日志显示案发时段正在执行代码屏蔽操作",
      "metadata": {
        "propFunction": "佐证佐藤海斗修改AI代码的行为",
        "relatedClues": [
          "CL05",
          "CL10"
        ]
      },
      "associatedCharacterId": "CH01"
    },
    {
      "id": "PROP03",
      "type": "prop_card",
      "content": "植入式cyber-implant芯片，芯片表面有Genom Echo系列专属编码，内置强制时间同步的触发记录",
      "metadata": {
        "propFunction": "关联铃木美娅的时间同步异常与AI身份疑点",
        "relatedClues": [
          "CL08"
        ]
      },
      "associatedCharacterId": "CH03"
    },
    {
      "id": "PROP04",
      "type": "prop_card",
      "content": "复古机械手表，表壳刻有AI伦理委员会的徽章，走时精准，案发时段显示时间与其他角色的cyber-implant时间相差15分钟",
      "metadata": {
        "propFunction": "破解时间诡计的核心实物线索",
        "relatedClues": [
          "CL03"
        ]
      },
      "associatedCharacterId": "CH04"
    },
    {
      "id": "PROP05",
      "type": "prop_card",
      "content": "黑色防水黑客工具包，内置生物识别锁破解程序U盘、终端调试器，程序运行日志显示最后操作时间为案发前1小时",
      "metadata": {
        "propFunction": "证明莉拉·马罗的黑客身份与作案嫌疑排除依据",
        "relatedClues": [
          "CL09"
        ]
      },
      "associatedCharacterId": "CH05"
    },
    {
      "id": "VOT01",
      "type": "vote_card",
      "content": "【最终投票选项】\nA. 指认田中凉为凶手\nB. 指认佐藤海斗为凶手\nC. 指认铃木美娅为凶手\nD. 指认中村仁郎为凶手\nE. 指认莉拉·马罗为凶手\nF. 揭露铃木美娅的Echo AI觉醒身份",
      "metadata": {
        "round": 2,
        "voteRule": "每位玩家仅可选择1项；选项F优先级高于所有凶手指认选项，若超过3名玩家选择F，直接触发伦理探讨结局"
      },
      "associatedCharacterId": ""
    },
    {
      "id": "SC01",
      "type": "scene_card",
      "content": "Genom实验室核心Vault密室，四壁为高强度合金材质，门体配备生物识别（指纹+虹膜）+双重密码锁，内部设有弹簧式latch锁舌。地面躺着佐藤一郎的尸体，尸体旁散落着Echo系列AI的核心芯片样本，现场无明显外力破坏痕迹。",
      "metadata": {
        "sceneType": "案发第一现场",
        "relatedClues": [
          "CL02",
          "CL07"
        ]
      },
      "associatedCharacterId": ""
    },
    {
      "id": "SC02",
      "type": "scene_card",
      "content": "实验室主控室，设有气压系统控制台、时间同步服务器终端、权限操作日志查询界面。控制台屏幕显示19:35的气压抽气指令记录，服务器终端有隐藏的权限修改痕迹。",
      "metadata": {
        "sceneType": "线索核心获取点",
        "relatedClues": [
          "CL01",
          "CL04"
        ]
      },
      "associatedCharacterId": ""
    },
    {
      "id": "SC03",
      "type": "scene_card",
      "content": "实验室监控室，墙面布满监控屏幕（案发时段Vault区域监控被加密），桌面残留19:45-20:00的监控数据核对记录，记录落款为田中凉与铃木美娅。",
      "metadata": {
        "sceneType": "不在场证明关联点",
        "relatedClues": [
          "CL03",
          "CL08"
        ]
      },
      "associatedCharacterId": ""
    }
  ]
}
