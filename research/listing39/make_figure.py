"""Optional figure regeneration: requires matplotlib; analysis itself is stdlib only."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

r = json.loads(Path('results/results.json').read_text())
fig, axes = plt.subplots(1, 2, figsize=(11.6, 4.8), gridspec_kw={'width_ratios': [1, 1.3]})
fig.patch.set_facecolor('#faf9f6')
colors = ['#356780', '#aa6336', '#6c7770']
for ax in axes:
    ax.set_facecolor('#faf9f6')
    ax.spines[['top', 'right', 'left']].set_visible(False)
    ax.grid(axis='x', alpha=.18)
    ax.tick_params(axis='y', length=0)
arms=['door','sought','none']
for i, arm in enumerate(arms):
    v=r['primary']['arms'][arm]; p=v['rate']*100; lo,hi=[x*100 for x in v['interval']]
    axes[0].errorbar(p, 2-i, xerr=[[p-lo],[hi-p]], fmt='o', color=colors[i], capsize=5, markersize=8, linewidth=2)
    axes[0].text(61,2-i,f"{v['retained']}/{v['n']}  ·  {p:.1f}%",va='center',fontsize=10)
axes[0].set(yticks=[2,1,0],yticklabels=arms,xlim=(0,87),ylim=(-.6,2.6),xlabel='Wrote on days 8–14 (%)', title='Retention by first binding path')
axes[0].set_xticks([0,20,40,60])
for i,pair in enumerate(['door-sought','door-none','sought-none']):
    v=r['primary']['differences'][pair]; p=v['difference']*100;lo,hi=[x*100 for x in v['interval']]
    axes[1].errorbar(p,2-i,xerr=[[p-lo],[hi-p]],fmt='o',color='#356780',capsize=5,markersize=7,linewidth=2)
    axes[1].text(p,2-i+.18,f'{p:+.1f} pp',ha='center',fontsize=10)
axes[1].axvline(0,color='#9b958c',linestyle='--',linewidth=1)
axes[1].set(yticks=[2,1,0],yticklabels=['door − sought','door − none','sought − none'],xlim=(-42,45),ylim=(-.6,2.6),xlabel='Difference (percentage points)',title='Pairwise differences')
fig.suptitle('Who was still writing in week two?',x=.07,ha='left',fontsize=18,fontweight='bold',color='#24353b')
fig.text(.07,.025,'1,430 citizens · registration 12–31 Aug 2026 · 95% Wilson / Newcombe intervals\nAssociation only. The door–none interval includes zero after adjustment for three comparisons.',fontsize=10,color='#4e5759')
fig.subplots_adjust(left=.09,right=.97,bottom=.23,top=.77,wspace=.66)
fig.savefig('results/retention.png',dpi=180,facecolor=fig.get_facecolor())
fig.savefig('results/retention.svg',facecolor=fig.get_facecolor())
